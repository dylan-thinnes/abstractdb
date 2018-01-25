//dbWrapper.js allows me to implement different databases in my code independently of their actual syntax.
var library; //Define the library variable at the global scope
var wrapper = function (libraryName) {
    //Actually implement logic.
    try {
        library = require(libraryName);
        if (libraryName === "sqlite3") library.verbose();
    } catch (e) {
        console.log("Database library with name of " + libraryName + " not found. Is it installed?");
        throw e;
        return;
    }
    switch (libraryName) {
        case "better-sqlite3": return BS3DB;
        case "sqlite3": return S3DB;
        default: throw "Unrecognized library name passed.";
    }
}
module.exports = wrapper;

//BS3DB is a class which optionally creates a better-sqlite3 database and then abstracts it.
var BS3DB = function (path, options, callback) {
    //Go through options to decide which items need abstraction.
    if (options == undefined) options = {};
    if (typeof path === "string" || path instanceof String) this.db = new library(path, options);
    else this.db = path;
}
//Define synchronous abstractions of better-sqlite3 functions
BS3DB.prototype.sGeneric = function (fName, statement, parameters) {
    if (parameters == undefined) parameters = {};
    for (var index in parameters) {
        parameters[index.slice(1)] = parameters[index];
        delete parameters[index];
    }
    if (typeof statement === "string") return this.db.prepare(statement)[fName](parameters);
    else return statement[fName](parameters);
}
BS3DB.prototype.sGet = function (statement, parameters) { return this.sGeneric("get", statement, parameters); }
BS3DB.prototype.sRun = function (statement, parameters) { return this.sGeneric("run", statement, parameters); }
BS3DB.prototype.sAll = function (statement, parameters) { return this.sGeneric("all", statement, parameters); }

//Define asynchoronous abstractions of better-sqlite3 functions
BS3DB.prototype.aGeneric = async function () { return this.sGeneric(...arguments); }
BS3DB.prototype.aGet = function (statement, parameters) { return this.aGeneric("get", statement, parameters); }
BS3DB.prototype.aRun = function (statement, parameters) { return this.aGeneric("run", statement, parameters); }
BS3DB.prototype.aAll = function (statement, parameters) { return this.aGeneric("all", statement, parameters); }

//S3DB is a class which optionally creates an sqlite3 database and then abstracts it.
var S3DB = function (path, options) {
    //Generate database from db
    if (options == undefined) options = {};
    if (typeof path === "string" || path instanceof String) {
        var path = options.memory ? ":memory:" : path;
        var readonly = options.readonly ? library.OPEN_READONLY : library.OPEN_READWRITE;
        var fileMustExist = options.fileMustExist ? library.OPEN_CREATE : 0;
        var mode = fileMustExist | readonly;
        this.db = new library.Database(path, mode);
    } else this.db = options;
}

//Define asychronous abstractions of sqlite3 functions.
S3DB.prototype.aGeneric = function (fName, statement, parameters) {
    return new Promise((resolve, reject) => {
        if (parameters == undefined) parameters = {};
        if (typeof statement === "string") {
            this.db[fName](statement, parameters, (err, result) => {
                if (err != undefined) reject(err);
                else resolve(result);
            });
        } else {
            this.db.prepare(statement)[fName](parameters, (err, result) => {
                if (err != undefined) reject(err);
                else resolve(result);
            });
        }
    });
}
S3DB.prototype.aGet = function (statement, parameters) { return this.aGeneric("get", statement, parameters); }
S3DB.prototype.aRun = function (statement, parameters) { return this.aGeneric("run", statement, parameters); }
S3DB.prototype.aAll = function (statement, parameters) { return this.aGeneric("all", statement, parameters); }

//Define a rather silly implementation of synchronous results. I very strongly recommend users stick to using async/await with aGeneric
S3DB.prototype.sGeneric = function (fName, statement, parameters) {
    var promiseResolved = false;
    var result;
    var outputResult = function (a) {
        promiseResolved = true;
        result = a;
    }
    this.aGeneric(fName, statement, parameters).then(outputResult);
    while (!promiseResolved) {}
    return result;
}
S3DB.prototype.sGet = function (statement, parameters) { return this.sGeneric("get", statement, parameters); }
S3DB.prototype.sRun = function (statement, parameters) { return this.sGeneric("run", statement, parameters); }
S3DB.prototype.sAll = function (statement, parameters) { return this.sGeneric("all", statement, parameters); }
