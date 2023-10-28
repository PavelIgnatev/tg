const axios = require('axios');
const promises = [];

console.time('Execution Time');

for (let i = 0; i < 100; i++) {
    promises.push(axios.get('http://194.135.25.158/answer/'));
}

Promise.all(promises)
    .then((responses) => {
        responses.forEach((response, index) => {
            console.log(`Response ${index + 1}:`, response.data);
        });
        console.timeEnd('Execution Time');
    })
    .catch((error) => {
        console.error(error);
    });
