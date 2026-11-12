// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var errors = require('restify-errors');

///--- Exports

/**
 * JSON formatter. Serializes the body with `JSON.stringify` (so a `toJSON()`
 * method on the body is honored); an `undefined` body is sent as `null`.
 *
 * @public
 * @function formatJSON
 * @param    {Object} req - the request object (not used)
 * @param    {Object} res - the response object
 * @param    {Object} body - response body
 * @returns  {String} data
 */
function formatJSON(req, res, body) {
    var data = 'null';
    if (body !== undefined) {
        try {
            data = JSON.stringify(body);
        } catch (e) {
            throw new errors.InternalServerError(
                { cause: e, info: { formatter: 'json' } },
                'could not format response body'
            );
        }
    }

    // Setting the content-length header is not a formatting feature and should
    // be separated into another module
    res.setHeader('Content-Length', Buffer.byteLength(data));

    return data;
}

module.exports = formatJSON;
