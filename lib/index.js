// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var assert = require('assert-plus');
var errors = require('restify-errors');

var pino = require('pino');
var Router = require('./router');
var Server = require('./server');
var shallowCopy = require('./utils').shallowCopy;

var InternalError = errors.InternalError;

/**
 * A restify server object is the main interface through which you will register
 * routes and handlers for incoming requests.
 *
 * @public
 * @function createServer
 * @param {Object} [options]  - an options object
 * @param {String} [options.name="restify"] - Name of the server. An empty
 * string suppresses the `Server` response header.
 * @param {Boolean} [options.dtrace=false] - enable DTrace support (requires
 * the optional `dtrace-provider` module).
 * @param {Router} [options.router=new Router(opts)] - Router. The default
 * router receives the full server options, so the `find-my-way` options below
 * apply to it.
 * @param {Boolean} [options.useSemicolonDelimiter=false] - strip
 * semicolon-delimited matrix parameters from a path segment before route
 * matching (passed through to `find-my-way`)
 * @param {Boolean} [options.ignoreDuplicateSlashes=false] - collapse duplicate
 * slashes before route matching (passed through to `find-my-way`).
 * @param {Boolean} [options.caseSensitive=true] - case-sensitive route
 * matching (passed through to `find-my-way`).
 * @param {Number} [options.maxParamLength=100] - maximum length of a path
 * parameter (passed through to `find-my-way`).
 * @param {Boolean} [options.allowUnsafeRegex=false] - allow potentially
 * catastrophic regular expressions in routes (passed through to
 * `find-my-way`).
 * @param {Object} [options.log=pino({name:options.name || "restify"})]
 * - logger. A [pino](https://github.com/pinojs/pino) instance by default; any
 * logger with `trace`/`debug`/`info`/`warn`/`error`/`fatal` methods and
 * `child()` (e.g. bunyan) may be passed.
 * @param {String|Buffer|Array} [options.certificate] - If you want to create an
 * HTTPS server, pass in a PEM-encoded certificate and key.
 * @param {String|Buffer|Array} [options.cert] - Alias of
 * `options.certificate`.
 * @param {String|Buffer|Array} [options.key] - If you want to create an HTTPS
 * server, pass in a PEM-encoded certificate and key.
 * @param {String|Buffer|Array} [options.ca] - passed to
 * `https.createServer()` along with `certificate` and `key`.
 * @param {String} [options.passphrase] - passed to `https.createServer()`
 * along with `certificate` and `key`.
 * @param {Boolean} [options.rejectUnauthorized] - passed to
 * `https.createServer()` along with `certificate` and `key`.
 * @param {Boolean} [options.requestCert] - passed to `https.createServer()`
 * along with `certificate` and `key`.
 * @param {String} [options.ciphers] - passed to `https.createServer()` along
 * with `certificate` and `key`.
 * @param {Number} [options.secureOptions] - passed to `https.createServer()`
 * along with `certificate` and `key`.
 * @param {Object} [options.formatters] - Custom response formatters for
 * `res.send()`, keyed by content type, merged over the built-in formatters.
 * See [formatter](#formatter).
 * @param {Boolean|Function} [options.handleUncaughtExceptions=false] - When
 * true restify will use a domain to catch and respond to any uncaught
 * exceptions that occur in its handler stack.
 * Comes with significant negative performance impact, and relies on the
 * deprecated `domain` module.
 * Can also be a function with signature `(req, res, onError, next)`, as an
 * alternative to domains: it must call `next(req, res)` to continue handling
 * the request, and should call `onError(err)` when it catches an error.
 * @param {Object} [options.http2] - Any options accepted by
 * [http2.createSecureServer](https://nodejs.org/api/http2.html). Enables
 * HTTP/2; when given, the HTTPS options above are ignored.
 * @param {Boolean} [options.handleUpgrades=false] - Hook the `upgrade` event
 * from the node HTTP server, pushing `Connection: Upgrade` requests through the
 *  regular request handling chain.
 * @param {Boolean} [options.onceNext=false] - Prevents calling next multiple
 *  times
 * @param {Boolean} [options.strictNext=false] - Throws error when next() is
 *  called more than once, enabled onceNext option
 * @param {Object} [options.httpsServerOptions] - Any options accepted by
 * [node-https Server](http://nodejs.org/api/https.html#https_https).
 * If provided the following restify server options will be ignored:
 * ca, certificate, key, passphrase, rejectUnauthorized, requestCert and
 * ciphers; however these can all be specified on httpsServerOptions.
 * @param {Boolean} [options.noWriteContinue=false] - prevents
 *  `res.writeContinue()` in `server.on('checkContinue')` when proxing
 * @param {Boolean} [options.ignoreTrailingSlash=false] - ignore trailing slash
 * on paths
 * @param {Boolean} [options.strictFormatters=true] - enables strict formatters
 * behavior: a formatter matching the response's content-type is required. If
 * not found, the response's content-type is automatically set to
 * 'application/octet-stream'. If a formatter for that content-type is not
 * found, sending the response errors.
 * @throws {AssertionError} if `process.env.HOST` is set to something other
 * than a bare host (it must not contain a scheme, path, query, fragment or
 * credentials).
 * @example
 * var restify = require('restify');
 * var server = restify.createServer();
 *
 * server.listen(8080, function () {
 *   console.log('ready on %s', server.url);
 * });
 * @returns  {Server} server
 */
function createServer(options) {
    assert.optionalObject(options, 'options');

    var host = process.env.HOST || 'localhost';
    if (
        host.includes('://') ||
        /[\/?#@]/.test(host) ||
        !URL.canParse('http://' + host)
    ) {
        assert.fail('Invalid HOST environment variable');
    }

    var opts = shallowCopy(options || {});
    var server;

    // empty string should override default value.
    opts.name = opts.hasOwnProperty('name') ? opts.name : 'restify';
    opts.log = opts.log || pino({ name: opts.name || 'restify' });
    opts.router = opts.router || new Router(opts);

    server = new Server(opts);

    if (opts.handleUncaughtExceptions) {
        server.on('uncaughtException', function onUncaughtException(
            req,
            res,
            route,
            e
        ) {
            if (
                this.listeners('uncaughtException').length > 1 ||
                res.headersSent
            ) {
                return false;
            }

            res.send(new InternalError(e, e.message || 'unexpected error'));
            return true;
        });
    }

    return server;
}

///--- Exports

module.exports.logger = pino;
module.exports.createServer = createServer;
module.exports.formatters = require('./formatters');
module.exports.plugins = require('./plugins');
module.exports.pre = require('./plugins').pre;
module.exports.helpers = { compose: require('./helpers/chainComposer') };
