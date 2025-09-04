# SQLi Vulnerable APP

A simple SQLi vulnerable application for SQL Injection testing.

## Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```

## Database Setup

1.  **Install PostgreSQL:**

    *   **On Debian/Ubuntu:**

        ```bash
        sudo apt update
        sudo apt install postgresql postgresql-contrib
        ```

    *   **On macOS (using Homebrew):**

        ```bash
        brew install postgresql
        ```

    *   **On Windows:**

        Download and install PostgreSQL from the [official website](https://www.postgresql.org/download/windows/).

2.  **Create a `.env` file:**

    Create a `.env` file in the directory and add the following lines, replacing the values with your PostgreSQL credentials:

    ```
    DB_USER=your_username
    DB_HOST=localhost
    DB_DATABASE=your_database
    DB_PASSWORD=your_password
    DB_PORT=5432
    ```

## Usage

```bash
npm start
```
And the site will be live at http://localhost:3000.

All the Frontend files are available at the /views folder.