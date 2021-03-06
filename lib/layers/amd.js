/*jslint node:true nomen:true white:true eqeq:true */
'use strict';

/** deps */
var path = require('path'),
	fs = require('fs'),
	requirejs = require('requirejs'),
	Cache = require('connect/lib/cache'),
	cache = new Cache();

/**
 * Configures commonjs layer.
 * @see https://github.com/jrburke/r.js/blob/master/build/tests/http/httpBuild.js
 * @type {Function}
 */
module.exports = function(options) {
	var files = options.scripts.files,
		config = {
			baseUrl: options.root,
			paths: {
				requireLib: path.join(__dirname, '../utils/mini_require')
			},
			optimize: 'none',		// XXX: no minification for now
			name: 'requireLib',
			include: []				// filled on-the-fly
//			sourceMap: options.scripts.sourceMap
		};

	// removes all leading slashs if any
	files = files.map(function(entry) {
		return ('/' == entry.charAt('/') ? entry.slice(1) : entry);
	});

	function respond(res, entry, cacheHeader) {
		res.setHeader('Content-Type', 'application/javascript');
		res.setHeader('X-Cache', cacheHeader);
		res.send(200, entry[0]);
	}

	/**
	 * The actual amd layer, invoked for each request hit.
	 * Concatenates a JavaScript file using the `AMD` paradigm.
	 *
	 * This is meant to be used with cache busting.
	 */
	return function amd(req, res, next) {
		var baseUrl = req.baseUrl.slice(1),
			url = req.url.slice(1),
			entry, moduleId;

		if (-1 != files.indexOf(url)) {
			// cache hit!
			if (entry = cache.get(baseUrl)) {
				respond(res, entry, 'HIT');
				return;
			}

			// cache miss
			// ad hoc config
			moduleId = path.basename(url).replace('.js', '');
			config.include[0] = moduleId;
			config.out = path.join(options.root, moduleId + '-compiled.js');

			// requirejs creates a concatened file.
			// we read it, put it in the cache and unlink it.
			requirejs.optimize(config, function () {
				fs.readFile(config.out, 'utf8', function(err, content) {
					entry = cache.add(baseUrl);
					entry.push(content);
					respond(res, entry, 'MISS');

					// lazy unlink
					fs.unlink(config.out);
				});
			}, function (err) {
				console.log(err.toString());
				next(500);
			});
		}
		else {
			next(null, req, res);
		}
	};
};
