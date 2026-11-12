// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';
///--- Exports

/**
 * Format a response for being sent over the wire.
 *
 * Formatters are keyed by content type in `createServer({ formatters })`.
 * A key may carry a q-value (e.g. `'application/foo; q=0.9'`) to control its
 * priority during content negotiation; the built-in formatters are keyed this
 * way. The returned value is written to the socket as-is, so it must be a
 * string, a Buffer, `null` or `undefined`.
 *
 * @public
 * @typedef {Function} formatter
 * @param    {Object} req - the request object
 * @param    {Object} res - the response object
 * @param    {*} body - response body to format
 * @returns  {String|Buffer|null|undefined} formatted response data
 */

module.exports = {
    'application/javascript; q=0.1': require('./jsonp'),
    'application/json; q=0.4': require('./json'),
    'text/plain; q=0.3': require('./text'),
    'application/octet-stream; q=0.2': require('./binary')
};
