# covid19-lga-arcgis-au
Lambda function that synchronize local government areas (LGA) related to COVID-19 updates into ArcGIS Online at hourly basis

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### How it works?

In every xx minutes, this lambda function will call an API provided by The Guardian. This API provides the details of all local government areas with the latest COVID-19 data. This lambda function will dynamically update the total cases of each location, the features of arcGIS layer. 

### Prerequisites

1. The app can be deploy as standalone NodeJS web app or as a AWS lambda function. To deploy to AWS Lambda, use [Serverless](https://serverless.com/)

### Installing

```
npm install
```

### Credentials and Registering your App

Finally, update [/global-settings.js](/global-settings.js) to contain your client ID, secret and the feature layer service url:

```javascript
module.exports = {
    client_id: 'xx',
    client_secret: 'xx',
    serviceUrl: 'xx',
    ...
};
```

### Deploy to AWS Lambda

```
sls deploy
```

### Running the Lambda function offline

```
sls offline start
```

### Manually trigger AWS Lambda function
```
sls invoke -f app
```

## To run as a NodeJS app

Comment out the Serverless handle and uncomment the local server part in [/index.js](/index.js)

```javascript
// module.exports.handler = serverless(app);

// USE THIS FOR LOCAL SERVER
var server = app.listen(3000, function() {
  console.log('app running on port.', server.address().port);
});
```

## Authors

- **Ho Xin Jun** - _Initial work_

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details