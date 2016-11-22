var LOG = require("winston"),
	Promise = require("bluebird"),
	mysql = require("mysql");

var pool;

function createPool(opts) {
	pool = mysql.createPool(opts);
	pool.getConnectionP = Promise.promisify(pool.getConnection, {
		context: pool
	});
	return pool;
}

function endPool(cb) {
	pool.end(cb);
}

function getConnection() {
	return pool.getConnectionP()
		.then(function(conn) {
			conn.queryP = Promise.promisify(conn.query, {
				context: conn,
				multiArgs: true
			});
			return Promise.resolve(conn);
		})
		.disposer(function(conn) {
			LOG.debug("in getConn disposer");
			conn.release();
		});
}

function getConnectionXact() {
	return pool.getConnectionP()
		.then(function(conn) {
			conn.queryP = Promise.promisify(conn.query, {
				context: conn,
				multiArgs: true
			});
			conn.commitP = Promise.promisify(function(opts, cb) {
				this.xact_done = true;
				return this.commit(opts, cb);
			}, {
				context: conn
			});
			conn.rollbackP = Promise.promisify(function(opts, cb) {
				this.xact_done = true;
				return this.rollback(opts, cb);
			}, {
				context: conn
			});
			conn.xact_done = false;
			return conn.queryP("START TRANSACTION")
				.then(function() {
					return Promise.resolve(conn);
				});
		})
		.disposer(function(conn) {
			LOG.debug("in getConnXact disposer");
			if (conn.xact_done) {
				LOG.debug("xact done; immediate release");
			} else {
				conn.rollback(function(err) {
					LOG.debug("rollback and release xact conn");
					conn.release();
				});
			}
		});
}

function promisify(obj) {
	obj.pget = Promise.promisify(obj.get);
	obj.prunQuery = Promise.promisify(obj.runQuery, {
		multiArgs: true
	});
	obj.psave = Promise.promisify(obj.save);
	return obj;
}

module.exports = {
	promisify: promisify,
	createPool: createPool,
	endPool: endPool,
	getConnection: getConnection,
	getConnectionXact: getConnectionXact
};
