# Discord Study Bot 📚

Discord Study Bot is a Discord bot designed to help users organize study sessions, manage to-do lists, and track study statistics. The bot allows users to start study sessions, join ongoing sessions, create to-do lists, and more.

## Features 🌟

- **Study Sessions 📖:** Start study sessions, join existing sessions, and track study time.
- **To-Do Lists ✅:** Manage your tasks with a to-do list that persists across sessions.
- **Study Statistics 📊:** View statistics from completed study sessions.
## Technologies Used

- **Discord.js 🤖:** A powerful library for interacting with the Discord API and building Discord bots.
- **SQLite3 🗃:️**A Node.js binding to SQLite, used for storing information about study sessions, to-do lists, and user sessions.
- **Dotenv 🔐:** Zero-dependency module to load environment variables, utilized here for loading the Discord bot token.

## Installation 🚀

To use the Discord Study Bot, follow these steps:

1. Clone the repository:
   git clone https://github.com/muzammilz7/Discord-Study-Bot.git
2. Install dependencies
    npm install discord.js sqlite3 dotenv
3. Set up SQLite database
    npm run setup-db
4. Run the bot
   npm start

## Commands 🤖
!startsession <duration>: Start a study session with the specified duration.
!joinsession: Join the active study session.
!leavesession: Leave the active study session.
!addtodo <task>: Add a task to your to-do list.
!removetodo <index>: Remove a task from your to-do list.
!todolist: View your current to-do list.
!studystats: View statistics from the last study session.

