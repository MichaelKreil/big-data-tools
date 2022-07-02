"use strict"

const cluster = require('cluster');
const os = require('os');

module.exports = {
	simpleCluster,
}

/*
	let items = [1,1,2,3,5]
	await items.forEachParallel(async (item, index) => {
		await doStuff(item)
	}, 16)
*/

Array.prototype.forEachParallel = forEachParallel;
function forEachParallel() {
	let callback, maxParallel = os.cpus().length;
	switch (arguments.length) {
		case 1: [ callback ] = arguments; break;
		case 2: [ maxParallel, callback ] = arguments; break;
		default:
			throw Error('forEachParallel( [ maxParallel, ] callback)')
	}

	let list = this;
	return new Promise((resolve, reject) => {
		let running = 0, index = 0, finished = false;

		queueMicrotask(next);

		function next() {
			if (finished) return;
			if (running >= maxParallel) return;
			if (index >= list.length) {
				if (running === 0) {
					finished = true;
					resolve();
					return
				}
				return
			}

			running++;
			let currentIndex = index++;

			callback(list[currentIndex], currentIndex)
				.then(() => {
					running--;
					queueMicrotask(next)
				})
				.catch(err => {
					finished = true;
					reject(err);
				})

			if (running < maxParallel) queueMicrotask(next);
		}
	})
}

/*
	Usage:
	simpleCluster(startWorker => {
		[1,1,2,3,5].forEachParallel(startWorker, 16)
	},
	(item, index) => {
		// do the work
	})
*/

async function simpleCluster() {
	let mainFunction, workerFunction, singleThread;
	switch (arguments.length) {
		case 2: [ mainFunction, workerFunction ] = arguments; break;
		case 3: [ singleThread, mainFunction, workerFunction ] = arguments; break;
		default:
			throw Error('simpleCluster( [ singleThread, ] mainFunction, workerFunction )')
	}

	if (singleThread) return await mainFunction(workerFunction);
	
	if (cluster.isMaster) {
		await mainFunction(function (...parameters) {
			return new Promise((resolve, reject) => {
				let worker = cluster.fork();
				worker.on('online', () => worker.send(({parameters})))
				worker.on('message', response => {
					if (response.error) {
						let error = Object.assign(new Error(), response.error);
						return reject(error)
					}
					return resolve(response.result);
				});
			})
		})
	} else if (cluster.isWorker) {
		process.on('message', async ({parameters}) => {
			let response = {};
			try {
				response.result = await workerFunction(...parameters);
			} catch (error) {
				response.error = {
					message: error.message,
					stack: error.stack,
					name: error.name,
				}
			}
			process.send(response, () => process.exit());
		})
	}
}

