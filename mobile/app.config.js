// Carrega `.env` / `.env.local` nesta pasta antes do Metro serializar `EXPO_PUBLIC_*`.
const path = require('path');
const { loadProjectEnv } = require('@expo/env');

loadProjectEnv(path.resolve(__dirname), { silent: true });

/** @type {import('@expo/config').ExpoConfig} */
const appJson = require('./app.json');

module.exports = {
  ...appJson.expo,
  extra: {
    ...appJson.expo.extra,
    eas: {
      projectId: '6a4b2280-5b79-4ca2-8a2a-61eb4b53a420',
    },
  },
};
