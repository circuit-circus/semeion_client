var MongoClient = require('mongodb').MongoClient
var ObjectId = require('mongodb').ObjectID;

var state = {
    client: null,
}

exports.connect = function(url, done) {
    if (state.db) {
        return done();
    }

    MongoClient.connect(url, function(err, client) {
        if (err) {
            return done(err);
        }
        state.client = client;
        done();
    });
}

exports.get = function(dbName) {
    try {
        let db = state.client.db(dbName);
        return db;
    } catch (err) {
        return err;
    }
}

exports.close = function(done) {
    if (state.db) {
        state.db.close(function(err, result) {
            state.db = null;
            state.mode = null;
            done(err);
        });
    }
}