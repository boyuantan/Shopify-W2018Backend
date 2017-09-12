var express = require('express');
var https = require('https');
var app = express();

// The API endpoint to obtain customer data
const BASE_URL = "https://backend-challenge-winter-2017.herokuapp.com/customers.json";

// Function to retrieve data from endpoint
function getData(url, page) {
	return new Promise(function(resolve, reject) {
		data = "";
		https.get(url + "?page=" + page.number, function(res) {
			res.on('data', function(chunk) {
				data += chunk;
			});
			res.on('end', function() {
				data = JSON.parse(data);
				page.done = 
					(data.pagination.current_page * data.pagination.per_page >= data.pagination.total);
				resolve(data); // Resolve with data
			});
		}).on('error', function(err) {
			console.log("Failed to retrieve data from endpoint!");
			reject(err); // Reject with error
		});
	});
};

function validateCustomers(validations, customers, invalids) { // Called pagely due to possibility of different pages w/different validations
	for (var c = 0; c < customers.length; c++) { // Loop through customer list
		var customer = customers[c];
		var cust_info = { id: customer.id, invalid_fields: [] }; // Initialize empty customer object
		for (var v = 0; v < validations.length; v++) {
			var validation = validations[v];
			var fieldName = Object.keys(validation)[0]; // Get fieldname
			validation = validation[fieldName];
			if (validation.required || customer[fieldName]) {
				if ((validation.required && customer[fieldName] == null) ||
					(validation.type && (validation.type != typeof customer[fieldName])) ||
					(validation.length && (customer[fieldName].length > validation.length.max || 
						customer[fieldName].length < validation.length.min))) {
					cust_info.invalid_fields.push(fieldName);
				}
			}
		}
		if (cust_info.invalid_fields.length > 0) { // Push to array holding invalid customer data
			invalids.push(cust_info);
		}
	}
	return invalids;
};

app.get('/', function(req, res) {
	var page = { number: 1, done: false };
	var promiseLoop = [];
	var invalids = [];

	var nextPromise = function(url, page) { // Function creating next Promise for the array
		if (!page.done) {
			var iterable = getData(url, page).then(function(data) { // Create iterable Promise
				validateCustomers(data.validations, data.customers, invalids);
				page.number++;
				promiseLoop.push(iterable); // Push iterable to Promise loop
				nextPromise(url, page);
			}).then(function() {
				if (page.done) { // Respond when fully completed
					res.send({ "invalid_customers" : invalids});
				}
			}).catch(function(err) {
				res.status(500).send(err);
			});
		}
	}
	nextPromise(BASE_URL, page);
	Promise.all(promiseLoop);
});

app.listen(process.env.port || 3000, function() { // Start server on localhost:3000 (or as specified)
	console.log("Server is running...");
});