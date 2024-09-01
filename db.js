const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database('./users.db')

db.serialize(() => {
	db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY)')
	db.run(
		'CREATE TABLE IF NOT EXISTS postponed_mailings (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, text TEXT, photo TEXT, urlButtonText TEXT, urlButtonLink TEXT)'
	)
})
const addUser = userId => {
	db.run('INSERT OR IGNORE INTO users (id) VALUES (?)', [userId])
}

const getUsers = callback => {
	db.all('SELECT id FROM users', (err, rows) => {
		if (err) {
			console.error(err)
			return
		}
		callback(rows.map(row => row.id))
	})
}

const getPostponedMailings = callback => {
    db.all('SELECT * FROM postponed_mailings', (err, rows) => {
        if (err) {
            console.error(err)
            return
        }
        callback(rows)
    })
}

module.exports = {
  db,
  addUser,
  getUsers,
  getPostponedMailings,
}