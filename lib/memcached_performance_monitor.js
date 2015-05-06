/**
 * This script was developed by Guberni and is part of Tellki's Monitoring Solution
 *
 * March, 2015
 * 
 * Version 1.0
 * 
 * DESCRIPTION: Monitor Memcache Performance
 *
 * SYNTAX: node memcached_performance_monitor.js <METRIC_STATE> <HOST> <PORT>
 * 
 * EXAMPLE: node memcached_performance_monitor.js "1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1" "10.10.2.5" "11211"
 *
 * README:
 *		<METRIC_STATE> is generated internally by Tellki and it's only used by Tellki default monitors: 1 - metric is on; 0 - metric is off
 *		<HOST> memcached ip address or hostname
 *		<PORT> memcached port
 */

var fs = require('fs');
var net = require('net');

var inputLength = 3;
var tempDir = '/tmp';
 
/**
 * Metrics.
 */
var metrics = [];

metrics['Threads'] 			   = { id: '1534:Threads:4', 				key : 'threads', 			rate : false };
metrics['CurrentItems'] 	   = { id: '1535:Current Items:4', 			key : 'curr_items', 		rate : false };
metrics['TotalItems'] 		   = { id: '1536:Total Items:4', 			key : 'total_items', 		rate : false };
metrics['StoreLimit'] 		   = { id: '1537:Store Limit:4', 		key : 'limit_maxbytes', 	rate : false, transform : function(v) { return v / 1024 / 1024; } };
metrics['StoreUsage'] 		   = { id: '1538:Store Usage:4', 			key : 'bytes', 				rate : false, transform : function(v) { return v / 1024 / 1024; } };
metrics['CurrrentConnections'] = { id: '1541:Currrent Connections:4', 	key : 'curr_connections', 	rate : false };

metrics['BytesRead/Sec'] 	= { id: '1539:Bytes Read/Sec:4', 	key : 'bytes_read', 		rate : true, transform : function(v) { return v / 1024 / 1024; } };
metrics['BytesWritten/Sec'] = { id: '1540:Bytes Written/Sec:4', key : 'bytes_written', 		rate : true, transform : function(v) { return v / 1024 / 1024; } };
metrics['Connections/Sec'] 	= { id: '1542:Connections/Sec:4', 	key : 'total_connections', 	rate : true };
metrics['Gets/Sec'] 		= { id: '1543:Gets/Sec:4', 			key : 'cmd_get', 			rate : true };
metrics['Sets/Sec'] 		= { id: '1544:Sets/Sec:4', 			key : 'cmd_set', 			rate : true };
metrics['GetHits/Sec'] 		= { id: '1545:Get Hits/Sec:4', 		key : 'get_hits', 			rate : true };
metrics['GetMisses/Sec'] 	= { id: '1546:Get Misses/Sec:4', 	key : 'get_misses', 		rate : true };
metrics['DeleteHits/Sec'] 	= { id: '1547:Delete Hits/Sec:4', 	key : 'delete_hits', 		rate : true };
metrics['DeleteMisses/Sec'] = { id: '1548:Delete Misses/Sec:4', key : 'delete_misses', 		rate : true };
metrics['IncrHits/Sec'] 	= { id: '1549:Incr Hits/Sec:4', 	key : 'incr_hits', 			rate : true };
metrics['IncrMisses/Sec']	= { id: '1550:Incr Misses/Sec:4', 	key : 'incr_misses', 		rate : true };
metrics['DecrHits/Sec'] 	= { id: '1551:Decr Hits/Sec:4', 	key : 'decr_hits', 			rate : true };
metrics['DecrMisses/Sec'] 	= { id: '1552:Decr Misses/Sec:4', 	key : 'decr_misses', 		rate : true };
metrics['Evictions/Sec'] 	= { id: '1553:Evictions/Sec:4', 	key : 'evictions', 			rate : true };
metrics['Reclaimed/Sec'] 	= { id: '1554:Reclaimed/Sec:4', 	key : 'reclaimed', 			rate : true };

/**
 * Entry point.
 */
(function() {
	try
	{
		monitorInput(process.argv);
	}
	catch(err)
	{	
		if(err instanceof InvalidParametersNumberError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else if(err instanceof UnknownHostError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else
		{
			console.log(err.message);
			process.exit(1);
		}
	}
}).call(this);

// ############################################################################
// PARSE INPUT

/**
 * Verify number of passed arguments into the script, process the passed arguments and send them to monitor execution.
 * Receive: arguments to be processed
 */
function monitorInput(args)
{
	args = args.slice(2);
	if(args.length != inputLength)
		throw new InvalidParametersNumberError();
	
	//<METRIC_STATE>
	var metricState = args[0].replace('"', '');
	var tokens = metricState.split(',');
	var metricsExecution = new Array();
	for(var i in tokens)
		metricsExecution[i] = (tokens[i] === '1');
	
	//<HOST> 
	var hostname = args[1];
	
	//<PORT> 
	var port = args[2];
	if (port.length === 0)
		port = '11211';

	// Create request object to be executed.
	var request = new Object()
	request.checkMetrics = metricsExecution;
	request.hostname = hostname;
	request.port = port;
	
	// Get metrics.
	processRequest(request);
}

// ############################################################################
// GET METRICS

/**
 * Retrieve metrics information
 * Receive: object request containing configuration
 */
function processRequest(request) 
{
	var keys = {};
	var metricsObj = [];
	var socket = net.Socket();
	
	socket.connect(request.port, request.hostname);
	socket.write('stats\n');

	socket.on('data', function(data) {

		// Parse data
		var lines = data.toString().split('\n');
		for (var i in lines)
		{
			var tokens = lines[i].trim().split(' ');
			if (tokens.length === 3)
				keys[tokens[1]] = tokens[2];
		}

		// Get values
		var dateTime = new Date().toISOString();
		var jsonString = '[';
		var i = 0;
		for(var key in metrics)
		{
			if (request.checkMetrics[i])
			{
				var metric = metrics[key];
				var val = keys[metric.key] + '';
		
				if (metric.transform !== undefined)
					val = metric.transform(val);
		
				jsonString += '{';
				jsonString += '"variableName":"' + key + '",';
				jsonString += '"metricUUID":"' + metric.id + '",';
				jsonString += '"timestamp":"' + dateTime + '",';
				jsonString += '"value":"' + val + '"';
				jsonString += '},';
			}
			i++;
		}

		if(jsonString.length > 1)
			jsonString = jsonString.slice(0, jsonString.length - 1);
		jsonString += ']';
		
		// Output
		processDeltas(request, jsonString);
		process.exit(0);
	});
	
	socket.on('error', function(data) {
		errorHandler(new UnknownHostError());
	});
	
	socket.end();
}

// ############################################################################
// OUTPUT METRICS

/**
 * Send metrics to console
 * Receive: metrics list to output
 */
function output(metrics)
{
	for (var i in metrics)
	{
		var out = '';
		var metric = metrics[i];
		
		out += metric.id;
		out += '|';
		out += metric.value;
		out += '|';
		
		console.log(out);
	}
}

// ############################################################################
// RATE PROCESSING

/**
 * Process performance results
 * Receive: 
 * - request object containing configuration
 * - retrived results
 */
function processDeltas(request, results)
{
	var file = getFile(request.hostname, request.port);
	var toOutput = [];
	
	if (file)
	{		
		var previousData = JSON.parse(file);
		var newData = JSON.parse(results);
			
		for(var i = 0; i < newData.length; i++)
		{
			var endMetric = newData[i];
			var initMetric = null;
			
			for(var j = 0; j < previousData.length; j++)
			{
				if(previousData[j].metricUUID === newData[i].metricUUID)
				{
					initMetric = previousData[j];
					break;
				}
			}
			
			if (initMetric != null)
			{
				var deltaValue = getDelta(initMetric, endMetric);
				
				var rateMetric = new Object();
				rateMetric.id = endMetric.metricUUID;
				rateMetric.timestamp = endMetric.timestamp;
				rateMetric.value = deltaValue;
				
				toOutput.push(rateMetric);
			}
			else
			{	
				var rateMetric = new Object();
				rateMetric.id = endMetric.metricUUID;
				rateMetric.timestamp = endMetric.timestamp;
				rateMetric.value = 0;
				
				toOutput.push(rateMetric);
			}
		}
		
		setFile(request.hostname, request.port, results);

		for (var m = 0; m < toOutput.length; m++)
		{
			for (var z = 0; z < newData.length; z++)
			{
				var systemMetric = metrics[newData[z].variableName];
				
				if (systemMetric.ratio === false && newData[z].metricUUID === toOutput[m].id)
				{
					toOutput[m].value = newData[z].value;
					break;
				}
			}
		}

		output(toOutput)
	}
	else
	{
		setFile(request.hostname, request.port, results);
		process.exit(0);
	}
}

/**
 * Calculate ratio metric's value
 * Receive: 
 * - previous value
 * - current value
 */
function getDelta(initMetric, endMetric)
{
	var deltaValue = 0;
	var decimalPlaces = 2;
	var date = new Date().toISOString();
	
	if (parseFloat(endMetric.value) < parseFloat(initMetric.value))
	{	
		deltaValue = parseFloat(endMetric.value).toFixed(decimalPlaces);
	}
	else
	{	
		var elapsedTime = (new Date(endMetric.timestamp).getTime() - new Date(initMetric.timestamp).getTime()) / 1000;	
		deltaValue = ((parseFloat(endMetric.value) - parseFloat(initMetric.value))/elapsedTime).toFixed(decimalPlaces);
	}
	
	return deltaValue;
}

/**
 * Get last results if any saved
 * Receive: 
 * - hostname or ip address
 * - port
 */
function getFile(hostname, port)
{
	var dirPath =  __dirname +  tempDir + '/';
	var filePath = dirPath + '.memcached_' + hostname + '_' + port + '.dat';
	
	try
	{
		fs.readdirSync(dirPath);
		
		var file = fs.readFileSync(filePath, 'utf8');
		
		if (file.toString('utf8').trim())
		{
			return file.toString('utf8').trim();
		}
		else
		{
			return null;
		}
	}
	catch(e)
	{
		return null;
	}
}

/**
 * Save current metrics values to be used to calculate ratios on next runs
 * Receive: 
 * - hostname or ip address
 * - port
 * - retrieved result
 */
function setFile(hostname, port, json)
{
	var dirPath =  __dirname +  tempDir + '/';
	var filePath = dirPath + '.memcached_' + hostname + '_' + port + '.dat';
		
	if (!fs.existsSync(dirPath)) 
	{
		try
		{
			fs.mkdirSync( __dirname + tempDir);
		}
		catch(e)
		{
			var ex = new CreateTmpDirError(e.message);
			ex.message = e.message;
			errorHandler(ex);
		}
	}

	try
	{
		fs.writeFileSync(filePath, json);
	}
	catch(e)
	{
		var ex = new WriteOnTmpFileError(e.message);
		ex.message = e.message;
		errorHandler(ex);
	}
}

// ############################################################################
// ERROR HANDLER

/**
 * Used to handle errors of async functions
 * Receive: Error/Exception
 */
function errorHandler(err)
{
	if(err instanceof UnknownHostError)
	{
		console.log(err.message);
		process.exit(err.code);
	}
	else if (err instanceof MetricNotFoundError)
	{
		console.log(err.message);
		process.exit(err.code);		
	}
	else if (err instanceof CreateTmpDirError)
	{
		console.log(err.message);
		process.exit(err.code);		
	}
	else if (err instanceof WriteOnTmpFileError)
	{
		console.log(err.message);
		process.exit(err.code);		
	}
	else
	{
		console.log(err.message);
		process.exit(1);
	}
}

// ############################################################################
// EXCEPTIONS

/**
 * Exceptions used in this script.
 */
function InvalidParametersNumberError() {
    this.name = 'InvalidParametersNumberError';
    this.message = 'Wrong number of parameters.';
	this.code = 3;
}
InvalidParametersNumberError.prototype = Object.create(Error.prototype);
InvalidParametersNumberError.prototype.constructor = InvalidParametersNumberError;

function UnknownHostError() {
    this.name = 'UnknownHostError';
    this.message = 'Unknown host.';
	this.code = 28;
}
UnknownHostError.prototype = Object.create(Error.prototype);
UnknownHostError.prototype.constructor = UnknownHostError;

function MetricNotFoundError() {
    this.name = 'MetricNotFoundError';
    this.message = '';
	this.code = 8;
}
MetricNotFoundError.prototype = Object.create(Error.prototype);
MetricNotFoundError.prototype.constructor = MetricNotFoundError;

function CreateTmpDirError()
{
	this.name = 'CreateTmpDirError';
    this.message = '';
	this.code = 21;
}
CreateTmpDirError.prototype = Object.create(Error.prototype);
CreateTmpDirError.prototype.constructor = CreateTmpDirError;

function WriteOnTmpFileError()
{
	this.name = 'WriteOnTmpFileError';
    this.message = '';
	this.code = 22;
}
WriteOnTmpFileError.prototype = Object.create(Error.prototype);
WriteOnTmpFileError.prototype.constructor = WriteOnTmpFileError;
