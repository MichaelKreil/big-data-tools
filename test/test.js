#!/usr/bin/env node

"use strict"

const { simpleCluster } = require('../');

simpleCluster(async w => {
	await [1,2,4,6].forEachParallel(w)
	console.log('✓ finished')
}, (item, index) => {
	if (item !== 2 ** index) throw Error();
})
