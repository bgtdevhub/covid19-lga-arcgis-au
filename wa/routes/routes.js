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
                url: `${settings.covid19SoureUrl}/query?where=Confirmed_cases%3E0&f=json&outFields=LGA_CODE19,Confirmed_cases,Classification&returnGeometry=false`,
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
            const locationsData = clientSourceData.features;

            //3. Update data to ArcGIS online feature layer
            const stateLong = "Western Australia";

            let updatedFeatures = [];

            const stateFeatures = featureData.features.filter(x => x.attributes.STE_NAME16 === stateLong);

            for (const location of locationsData) {
                const locationFeatureData = stateFeatures.find(x => x.attributes.LGA_CODE19 === location.attributes.LGA_CODE19);

                if (locationFeatureData) {
                    const cases = location.attributes.Confirmed_cases ? location.attributes.Confirmed_cases : null;
                    const date = new Date();

                    const updatedFeatureData = {
                        objectId: locationFeatureData.attributes.OBJECTID,
                        cases: getFormattedNumber(cases),
                        casesStr: location.attributes.Classification,
                        lastUpdated: getEsriFormattedDate(date),
                    };
                    updatedFeatures.push(updatedFeatureData);
                }
            }

            await updateStatesFeature(updatedFeatures, token);

            res.status(200).send('Synchronization completed.');

            return;
        } catch (error) {
            console.log(error);
        }
    });
};

module.exports = appRouter;