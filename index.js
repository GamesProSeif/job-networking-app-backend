const express = require("express");
const mysql = require("mysql");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const cors = require("cors");
const passport = require("passport");
const LocalStrategy = require("passport-local");

const db = mysql.createConnection({
	host:"localhost",
	user: "root",
	database: "job_networking"
});

db.connect((err) => {
	if (err)
		throw err;
	console.log("Connected to DB");
})

const app = express();

app.use(cors({
	origin: "http://localhost:5173",
	credentials: true
}));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use(session({
	secret: "i love pizza",
	resave: false,
	saveUninitialized: true,
	cookie: {
		secure: false,
		httpOnly: false,
		maxAge: 15 * 24 * 60 * 60 * 1000
	}
}));

app.use(cookieParser());

passport.initialize();
passport.session();
app.use(passport.authenticate("session"));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

passport.use(new LocalStrategy({ session: true }, function verify(email, password, cb) {
	db.query(
		`SELECT *
		FROM base_user, user_email
		WHERE base_user.USER_ID = user_email.USER_ID AND EMAIL = ${mysql.escape(email)}`,
		(err, result) => {
			const user = result[0];
			if (err)
				return cb(err)
			if (!user)
				return cb(null, false, { message: "Incorrect username or password" });

			if (password == user.PASSWORD) {
				return cb(null, user);
			}
			else
				return cb(null, false, { message: "Incorrect username or password" });
	})
}));

app.post("/login/password", passport.authenticate("local", {
	successRedirect: "http://localhost:5173/",
	failureRedirect: "http://localhost:5173/signin"
}));

app.get("/logout", (req, res) => {
	req.logout(() => {
		res.redirect("http://localhost:5173/signin");
	});
});

app.get("/", (req, res) => {
	res.send("Hello world");
});

app.get("/me", (req, res) => {
	if (req.user) {
		const { password, ...user } = req.user;
		return res.status(200).json(user);
	} else
		return res.status(401).json({ error: "not logged in" });
});

app.get("/users", (req, res) => {
	db.query(
		`SELECT *
		FROM base_user, user_email
		WHERE base_user.USER_ID = user_email.USER_ID AND EMAIL = ${mysql.escape(req.query.email)}` ,
		(err, result, fields) => {
			if (err)
				throw err;
			res.send(result);
	})
});

app.get("/users/:id", (req, res) => {
	db.query(`SELECT * FROM base_user WHERE USER_ID = ${mysql.escape(req.params.id)} LIMIT 1`, (err, result) => {
		if (err)
			throw err;
		res.send(result[0] || { error: "No user with requested id" });
	})
});

app.post("/users", (req, res) => {
	db.query(
		`SELECT *
		FROM base_user, user_email
		WHERE base_user.USER_ID = user_email.USER_ID AND EMAIL = ${mysql.escape(req.body.email)}` ,
		(err, result, fields) => {
			if (err)
				throw err;

			if (result.length !== 0)
				return res.status(400).json({ error: "email already exists" });

			db.query(
				`INSERT INTO BASE_USER (PROFILE_PIC, NAME, PREMIUM, PASSWORD)
				VALUES ('default.png', ?, FALSE, ?);`,
				[`${req.body.firstName} ${req.body.lastName}`, req.body.password],
				(err, result) => {
					if (err) {
						res.status(500).json({ error: "an error has occured"});
						console.error(err);
					}

					db.query(
						`INSERT INTO USER_EMAIL (USER_ID, EMAIL) VALUES (?, ?);`,
						[result.insertId, req.body.email],
						(err1, result1) => {
							if (err1) {
								res.status(500).json({ error: "an error has occured"});
								console.error(err1);
							}

							res.status(200).json({ message: "ok" })
						}
					)
				}
			)
	});

});

app.post("/reset-password", (req, res) => {
	if (!req.user)
		return res.status(401).json({ error: "not logged in" });
	if (!req.body.new_password)
		return res.status(401).json({ error: "invalid password" });

	db.query("UPDATE BASE_USER SET PASSWORD = ? WHERE USER_ID = ?", [req.body.new_password, req.user.USER_ID], (err, results) => {
		if (err) {
			console.error(err);
			return res.status(500).json({ error: "an error has occurred" });
		}

		return res.redirect("/logout");
	})
});

app.listen(5000, () => console.log("Started server on http://localhost:5000"));
