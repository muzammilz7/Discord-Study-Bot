// Import necessary modules
const { Client, Intents, IntentsBitField } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.GuildMembers,
    ],
});

const prefix = '!';
const db = new sqlite3.Database('SessionData');

// Table for study_sessions
db.run(`
    CREATE TABLE IF NOT EXISTS study_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        initiator_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        duration INTEGER NOT NULL,
        participants TEXT NOT NULL,
        start_time INTEGER NOT NULL
    )
`);

// Table for todo_lists 
db.run(`
    CREATE TABLE IF NOT EXISTS todo_lists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        todo_items TEXT NOT NULL
    )
`);

// Table for user_sessions 
db.run(`
    CREATE TABLE IF NOT EXISTS user_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        duration INTEGER NOT NULL,
        start_time INTEGER NOT NULL
    )
`);

// Defined maps
const studySessions = new Map();
const todoLists = new Map();

client.once('ready', () => {
    console.log(`${client.user.tag} is ready!`);
});

client.on('messageCreate', (message) => {
    if (message.author.bot || !message.content.startsWith(prefix)) {
        return;
    }

    const [command, ...args] = message.content.slice(prefix.length).split(' ');

    // User command options
    if (command === 'startsession') {
        startStudySession(message, args);
    } else if (command === 'joinsession') {
        joinStudySession(message);
    } else if (command === 'leavesession') {
        leaveStudySession(message);
    } else if (command === 'addtodo') {
        addToDoList(message, args);
    } else if (command === 'removetodo') {
        removeToDoItem(message, args);
    } else if (command === 'todolist') {
        displayToDoList(message);
    } else if (command === 'studystats') {
        displayStudyStats(message);
    }
});

// Function to start a study session
function startStudySession(message, args) {
    
    if (studySessions.has(message.channel.id)) {
        message.reply('A study session is already active.');
        return;
    }

    // Get the study duration 
    const duration = parseInt(args[0]);

    // Check if the duration is a valid number
    if (isNaN(duration) || duration <= 0) {
        message.reply('Please provide a valid study duration in minutes.');
        return;
    }

    // Create a study session object
    const studySession = {
        initiator: message.author,
        channel: message.channel,
        duration: duration * 60000,
        participants: [message.author],
        startTime: Date.now(),
    };

    // Add the study session to the map
    studySessions.set(message.channel.id, studySession);

    // Add the study session to the database
    db.run('INSERT INTO study_sessions (initiator_id, channel_id, duration, participants, start_time) VALUES (?, ?, ?, ?, ?)',
        [studySession.initiator.id, studySession.channel.id, studySession.duration, JSON.stringify(studySession.participants), studySession.startTime]);

    message.channel.send(`Study session started by ${message.author.username}. Duration: ${duration} minutes. Type !joinsession to join.`);

    // Set up countdown timer
    const interval = 600000; 
    const timer = setInterval(() => {
        const elapsedTime = Date.now() - studySession.startTime;
        const remainingTime = studySession.duration - elapsedTime;

        if (remainingTime > 0) {
            const remainingMinutes = Math.ceil(remainingTime / 60000);
            message.channel.send(`Time remaining: ${remainingMinutes} minutes.`);
        } else {
            clearInterval(timer);
            message.channel.send('Study session has ended. Good work!');

            // Store the user's study session
            const studyDuration = duration * 60000; 
            db.run('INSERT INTO user_sessions (user_id, duration, start_time) VALUES (?, ?, ?)',
                [message.author.id, studyDuration, studySession.startTime]);
        }
    }, interval);
}

// Join a study session
function joinStudySession(message) {
    // Check if a session is active
    if (studySessions.has(message.channel.id)) {
        const studySession = studySessions.get(message.channel.id);

        // Update session information
        const updatedSession = client.channels.cache.get(studySession.channel.id).guild.members.cache.get(studySession.initiator.id);
        studySession.initiator = updatedSession;

        // Check for if user is a participant
        if (studySession.participants.includes(message.author.id)) {
            message.reply('You are already a participant in the study session.');
        } else {
            // Add the user to the participant list
            studySession.participants.push(message.author.id);
            
            // Update the database record with the new participants
            db.run('UPDATE study_sessions SET participants = ? WHERE channel_id = ?',
                [JSON.stringify(studySession.participants), message.channel.id]);

            message.reply(`You have successfully joined the study session. Participants: ${studySession.participants.length}`);
        }
    } else {
        message.reply('No active study sessions. Use !startsession to start one.');
    }
}

// Function to leave a study session
function leaveStudySession(message) {
    // Check if a session is active
    if (studySessions.has(message.channel.id)) {
        const studySession = studySessions.get(message.channel.id);

        // Check if the user is the initiator
        if (studySession.initiator.id === message.author.id) {
            // If the initiator is leaving, end the session for everyone
            endStudySession(message.channel.id);
        } else {
            // Remove the user from the participant list
            const participantIndex = studySession.participants.indexOf(message.author.id);
            if (participantIndex !== -1) {
                studySession.participants.splice(participantIndex, 1);

                // Update the database record with the new participants
                db.run('UPDATE study_sessions SET participants = ? WHERE channel_id = ?',
                    [JSON.stringify(studySession.participants), message.channel.id]);

                message.reply(`You have left the study session. Participants: ${studySession.participants.length}`);
            } else {
                message.reply('You are not a participant in the study session.');
            }
        }
    } else {
        message.reply('No active study sessions. Use !startsession to start one.');
    }
}

// Function to end a study session
function endStudySession(channelId) {
    const studySession = studySessions.get(channelId);

    // Clear the session timer
    clearInterval(studySession.timer);

    // Store the user's study session
    const studyDuration = studySession.duration;
    db.run('INSERT INTO user_sessions (user_id, duration, start_time) VALUES (?, ?, ?)',
        [studySession.initiator.id, studyDuration, studySession.startTime]);

    // Remove the study session from the map and database
    studySessions.delete(channelId);
    db.run('DELETE FROM study_sessions WHERE channel_id = ?', [channelId]);

    // Notify participants that the study session has ended
    const endMessage = 'Study session has ended. Good work!';
    studySession.participants.forEach((participantId) => {
        const participant = client.users.cache.get(participantId);
        if (participant) {
            participant.send(endMessage);
        }
    });

    const channel = client.channels.cache.get(channelId);
    if (channel) {
        channel.send(endMessage);
    }
}

function addToDoList(message, args) {
    const todoItem = args.join(' ');

    db.serialize(() => {
        // Check if user has a todo list in the database
        db.get('SELECT * FROM todo_lists WHERE user_id = ?', [message.author.id], (err, row) => {
            if (err) {
                console.error(err.message);
                return;
            }

            if (!row) {
                // Create new record if user does not have a todolist
                db.run('INSERT INTO todo_lists (user_id, todo_items) VALUES (?, ?)', [message.author.id, JSON.stringify([todoItem])]);

                // Update map
                todoLists.set(message.author.id, [todoItem]);
            } else {
                // Update record if todolist exists
                const userTodoList = JSON.parse(row.todo_items);
                userTodoList.push(todoItem);
                db.run('UPDATE todo_lists SET todo_items = ? WHERE user_id = ?', [JSON.stringify(userTodoList), message.author.id]);

                // Update map
                todoLists.set(message.author.id, userTodoList);
            }

            // Notify user
            message.reply(`Todo item added: ${todoItem}`);
        });
    });
}

// Function to display study session stats
function displayStudyStats(message) {
    // Retrieve study session stats
    db.get('SELECT * FROM study_sessions WHERE channel_id = ? ORDER BY start_time DESC LIMIT 1', [message.channel.id], (err, row) => {
        if (err) {
            console.error(err.message);
            return;
        }

        if (row) {
            const participantsArray = JSON.parse(row.participants);
            const statsMessage = `Study Session Stats:
                - Initiator: ${row.initiator_id}
                - Duration: ${row.duration / 60000} minutes
                - Participants: ${participantsArray.length}
            `;

            message.channel.send(statsMessage);
        } else {
            message.reply('No study session stats found.');
        }
    });
}

// Function to display the user's todo list
function displayToDoList(message) {
    // Check if user has a todo list
    if (todoLists.has(message.author.id)) {
        const userTodoList = todoLists.get(message.author.id);

        if (userTodoList.length > 0) {
            const todoListMessage = `todo List for ${message.author.username}:
                ${userTodoList.map((item, index) => `${index + 1}. ${item}`).join('\n')}
            `;
            message.channel.send(todoListMessage);
        } else {
            message.reply('Your todo list is empty! Use !addtodo to add items.');
        }
    } else {
        message.reply('Your todo list is empty! Use !addtodo to add items.');
    }
}

// Function to remove a todo item 
function removeToDoItem(message, args) {
    // Check if user has a todo list
    if (todoLists.has(message.author.id)) {
        const userTodoList = todoLists.get(message.author.id);

        // Check if the command includes a valid index
        const indexToRemove = parseInt(args[0]);

        if (isNaN(indexToRemove) || indexToRemove <= 0 || indexToRemove > userTodoList.length) {
            message.reply('Please provide a valid todo item index to remove.');
            return;
        }

        // Remove the item and update the todo list
        const removedItem = userTodoList.splice(indexToRemove - 1, 1)[0];
        todoLists.set(message.author.id, userTodoList);

        // Update the todo lists map
        db.run('UPDATE todo_lists SET todo_items = ? WHERE user_id = ?', [JSON.stringify(userTodoList), message.author.id]);

        message.reply(`todo item removed: ${removedItem}`);
    } else {
        message.reply('Your todo list is empty! Use !addtodo to add items.');
    }
}

client.login(process.env.BOT_TOKEN);