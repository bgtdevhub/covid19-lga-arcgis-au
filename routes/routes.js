const request = require('request');
const settings = require('../global-settings.js');

const requestToken = () =>
    // generate a token with client id and client secret
    new Promise((resolve, reject) => {
        console.log('client_id:' + settings.client_id);
        request.post(
            {
                url: settings.oauth2Url,
                json: true,
                form: {
                    f: 'json',
                    client_id: settings.client_id,
                    client_secret: settings.client_secret,
                    grant_type: 'client_credentials',
                    expiration: '1440'
                }
            },
            function (error, response, { access_token }) {
                if (error) reject(error);

                resolve(access_token);
            }
        );
    });

const getFeatureData = token =>
    new Promise((resolve, reject) => {
        request(
            {
                url: `${settings.serviceUrl}/query?token=${token}&where=1%3D1&f=json&outFields=OBJECTID,LGA_CODE19,LGA_NAME19,STE_NAME16&returnGeometry=false`,
                headers: {},
                method: 'GET',
                encoding: null
            },
            function (error, res, body) {
                if (res.statusCode == 200 && !error) {
                    resolve(JSON.parse(body));
                }
                reject(error);
            }
        );
    });

const getClientSoureUpdates = () =>
    new Promise((resolve, reject) => {
        request(
            {
                url: settings.covid19SoureUrl,
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': '',
                },
                method: 'GET',
                encoding: null
            },
            function (error, res, body) {
                if (res.statusCode == 200 && !error) {
                    resolve(JSON.parse(body));
                }
                reject(error);
            }
        );
    });

const updateStatesFeature = (updatedSites, token) =>
    new Promise((resolve, reject) => {
        const updates = updatedSites.map(data => {
            return {
                attributes: {
                    OBJECTID: data.objectId,
                    Cases: data.cases,
                    Cases_Str: data.casesStr,
                    LastUpdated: data.lastUpdated
                }
            };
        });
        request.post(
            {
                url: `${settings.serviceUrl}/applyEdits`,
                json: true,
                formData: {
                    updates: JSON.stringify(updates),
                    f: 'json',
                    token: token
                }
            },
            function (error, response, body) {
                if (error) {
                    reject(error);
                } else {
                    const successes = body.updateResults.filter(x => !x.error);
                    const errors = body.updateResults.filter(x => x.error);

                    console.log(`features updated (Succeed): ${successes.length}`);
                    console.log(`features updated (Failed): ${errors.length} ${errors.length > 0 ? JSON.stringify(errors) : ''}`);

                    resolve(body.updateResults);
                }
            }
        );
    });

const getFormattedNumber = value => {
    if (value) {
        if (!isNaN(value)) {
            return value;
        }
        else {
            const cleaned = value.replace(",", "");
            return Number(cleaned);
        }
    }
    else {
        return null;
    }
}

const getMidpoint = value => {
    if (value) {
        if (value.includes("-")) {
            const points = value.split("-");
            const minPoint = getFormattedNumber(points[0]);
            const maxPoint = getFormattedNumber(points[1]);

            return Math.floor((minPoint + maxPoint) / 2);
        } else {
            return getFormattedNumber(value);
        }
    }
    else {
        return null;
    }
}

const getDayMonthYear = (date) => {
    const dateString = date.split('/');
    const day = dateString[0];
    const month = dateString[1];
    const year = dateString[2];

    return new Date(year, month - 1, day);
}

const getEsriFormattedDate = (date) => {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

const appRouter = app => {
    app.get('/', async (req, res) => {
        console.log("Synchronization started.")
        try {
            //1. Request tokens from ArcGIS online
            const token = await requestToken();
            console.log(`token: ${token}`);

            //2. Get data from client resource & existing ArcGIS online feature layer
            const clientSourceData = await getClientSoureUpdates();
            const featureData = await getFeatureData(token);
            const locationsData = clientSourceData.sheets["locations"];

            //3. Update data to ArcGIS online feature layer
            const victoriaShort = "VIC";
            const victoriaLong = "Victoria";

            let updatedFeatures = [];

            const victoriaFeatures = featureData.features.filter(x => x.attributes.STE_NAME16 === victoriaLong);
            const victoriaLocationsTotal = locationsData.filter(x => x["State"] === victoriaShort);

            for (const victoriaLocation of victoriaLocationsTotal) {
                const locationFeatureData = victoriaFeatures.find(x => x.attributes.LGA_NAME19 === victoriaLocation.Location);

                if (locationFeatureData) {
                    const cases = victoriaLocation["Cases"] ? victoriaLocation["Cases"] : null;
                    const date = getDayMonthYear(victoriaLocation["Date"]);

                    const updatedFeatureData = {
                        objectId: locationFeatureData.attributes.OBJECTID,
                        cases: getMidpoint(cases),
                        casesStr: cases,
                        lastUpdated: getEsriFormattedDate(date),
                    };
                    updatedFeatures.push(updatedFeatureData);
                }
            }

            const updateLatestResult = await updateStatesFeature(updatedFeatures, token);

            res.status(200).send('Synchronization completed.');

            return;
        } catch (error) {
            console.log(error);
        }
    });
};

module.exports = appRouter;