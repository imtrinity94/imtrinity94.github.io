### Introduction
This action can be utilized as the lowest level action with any form of REST communication, to be called by higher level actions or workflows.  It encapsulate the REST communication with the vRO REST plugin into one spot, checks for errors always, and provides a simplified mechanism of working with REST calls within vRO.  Callers of this REST action get to operate at a higher level of abstraction which greatly improves readability as the caller gets to just list out the REST communication details from an API standpoint, rather than mixing in the mechanism by which it's done at the vRO level (ie: vRO REST plugin).

The action makes the assumption (and sets appropriate headings) that the body will be JSON and that the accepted response is JSON.  Since vRO is developed with JavaScript, the action also makes the assumption that the body is an actual JavaScript object which is serialized to JSON before sending it off, which makes the construction of the body much simpler.

```javascript
// VMware vRealize Orchestrator action sample - "executeRestRequest"
//
// Execute API calls against target REST Host directly by providing the high level inputs.
// Action takes care of formulating the request object and executing the request, capturing errors, and JSON <-> JavaScript object translation (inputs are JS objects, outputs are JS objects);
// Finds the REST Host dynamically and constructs the full url and an adhoc REST Operation.
//
// restHostName - string - RESTHost name (must exist in Inventory by this name)
// method - string - HTTP Method ("GET", "POST", etc)
// operation - string - Operation URL ("/networks/192.168.1.0")
// body - Any - JavaScript object (will be serialized for the body)
// additionalHeaders - Properties- Additional Headers to apply to the request (such as Authentication)
//
// Return type: Any (JavaScript object, ie: deserialized JSON response)
//

var request = createRequest(restHostName, method, operation, body, additionalHeaders);
var content = executeRequest(request, restHostName);

return getResult(content);

/////////////////////////////////////////////////////////////////////////////////////////////////////
function createRequest(restHostName, method, operation, body, additionalHeaders) {
	var restHost = getRestHostByName(restHostName);
	
	var request = restHost.createRequest(method, operation, getBodyJson(body));
	addHeaders(request, additionalHeaders);
		
	System.debug("    Request: " + request);
	System.debug("    Request URL: " + request.fullUrl);

	return request;
}

function addHeaders(request, additionalHeaders) {
	request.contentType = "application/json";
	request.setHeader("Accept", "application/json");
	
	for each (var key in additionalHeaders.keys) {
		var value = additionalHeaders.get(key);
		System.debug("additionalHeaders = " + key + " : " + value);
		request.setHeader(key, value);
	}
}

function executeRequest(request, restHostName) {
	var response = request.execute();
	var contentAsString = response.contentAsString;
	var statusCode = response.statusCode;
	System.debug("    Status Code: " + statusCode);
	System.debug("    Response: " + contentAsString);
	
	if (parseInt(statusCode) >= 400) {
		throw "Error while requesting from the REST host " + restHostName + " and the url " +  request.fullUrl 
				+ " (Status Code " + statusCode + "):" + contentAsString;
	}
	
	return contentAsString;
}


function getBodyJson(body) {
	if (body === null) {
		return null;
	}
	var bodyJSON = JSON.stringify(body);
	System.debug("JS body: " + bodyJSON);
	return bodyJSON;
}

function getRestHostByName(restHostName) {
	var allHosts = Server.findAllForType("REST:RESTHost", null);

	System.debug("Finding REST Host by name '" + name + "'");

	for each (var host in allHosts) {
		if (host.name === restHostName) {
			System.debug("Found REST Host '" + name + "'!");
			return host;
		}
	}

	throw "Unable to find a REST:Host with the name " + name;
}


function getResult(content) {
	if (isEmpty(content)) {
		return null;
	}
	var result = JSON.parse(content);
	System.debug("response JSON: " + JSON.stringify(result, null, 4));
	return result;
}

function isEmpty(input) {
	return input === null || input === "";
}
```

### Example Usage
The following is an example of another action which is constructed as a building block itself to encapsulate a specific REST operation with a particular system.  The system is fictitious to illustrate the various elements of the call to the provided executeRestRequest action.  

```javascript
// VMware vRealize Orchestrator action sample - "createNewNetwork"
//
// networkAddressInput - string - Network address such as 192.168.1.0
// subnetMaskInput - string - Subnet mask such as 255.255.255.0
//
// Return type: Any (JavaScript object depicting newly created network and details)
//

var endpointName = "IPAM-SYSTEM";
var operation = "/networks/" + networkAddressInput;
var method = "PUT";
var body = {
    subnetMask: subnetMaskInput 
};

var additionalHeaders = new Properties({
    "networkView":  "default"
});


var networkDetails = System.getModule("com.companyName.rest.common").executeRestRequest(endpointName, method, operation, body, additionalHeaders);
System.debug("Default gateway for new network = " + networkDetails.gateway);

return networkDetails;
```

The example provided could be further optimized if multiple operations are performed to the same REST system.  Rather than calling executeRestRequest directly, this createNewNetwork example action could call a new executeRestRequestForIPAMsystem which in turn would call the executeRestRequest, yet executeRestRequestForIPAMsystem would be responsible for defining the "endpointName" in one spot ("IPAM-SYSTEM") as well as always adding the same additional header of networkView.
