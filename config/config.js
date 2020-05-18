'use strict';

require("dotenv").config();

const helper        = require(__dirname + '/../helper/helper.js');

const fs            = require('fs');
const path          = require('path');

process.env.NODE_ENV = process.env.NODE_ENV || 'staging';
const env = process.env;

console.log(`\nNODE_ENV: ${env.NODE_ENV}`);

exports.isDebug = () => {
    const isDev = env.NODE_ENV.toLocaleLowerCase() === 'development' || env.NODE_ENV.toLocaleLowerCase() === 'staging';

    return isDev;
}

exports.isDev = () => {
    const isDev = env.NODE_ENV.toLocaleLowerCase() === 'development';

    return isDev;
}

exports.isStage = () => {
    const isStage = env.NODE_ENV.toLocaleLowerCase() === 'staging';

    return isStage;
}

exports.dbConfigAll = {
    development: helper.parseSettingsConfig(env.DATABASE_DEV_URL),
    development_test: helper.parseSettingsConfig(env.DATABASE_DEV_TEST_URL),
    staging: helper.parseSettingsConfig(env.DATABASE_STAGING_URL),
    production: helper.parseSettingsConfig(env.DATABASE_PRODUCTION_URL),
    use: () => {
        const config = this.dbConfigAll[env.NODE_ENV];
        return config;
    }
}

exports.dbConfig        = this.dbConfigAll.use();
exports.dbTestConfig    = this.isDev() ? this.dbConfigAll['development'] : this.dbConfigAll['development_test'];

let key, cert;
const keyFile = 'certificate.key';
const cerFile = 'certificate.crt';

try {
    key = fs.readFileSync(path.resolve(`../certificate-files/${keyFile}`));
} catch (err) {
    console.log(`Server SSL key not found: ${keyFile}`)
}

try {
    cert = fs.readFileSync(path.resolve(`../certificate-files/${cerFile}`));
} catch (err) {
    console.log(`Server SSL cert not found: ${cerFile}`)
}

exports.certificate         = { key: key, cert: cert };

exports.serverConfig        = helper.parseSettingsConfig(env.SERVER_CONFIG);
exports.jwtConfig           = helper.parseSettingsConfig(env.JWT_CONFIG);
exports.socketConfig        = helper.parseSettingsConfig(env.SOCKET_CONFIG);
exports.redisConfig         = helper.parseSettingsConfig(env.REDIS);

exports.mailAuth            = helper.parseSettingsConfig(env.MAIL_AUTH);
exports.mailConfig          = helper.parseSettingsConfig(env.MAIL_CONFIG);

exports.development         = helper.parseSettingsConfig(env.DEVELOPMENT_ENV);
exports.staging             = helper.parseSettingsConfig(env.STAGING_ENV);
exports.production          = helper.parseSettingsConfig(env.PRODUCTION_ENV);

exports.envConfig = {
    development: this.development,
    staging: this.staging,
    production: this.production,
    use: (type) => {
        const config = this.envConfig[env.NODE_ENV];
        return config[type];
    },
    test: (host = 'http://127.0.0.1', port = '7746') => {
        return `${host}:${port}`;
    }
}

exports.bcryptConfig = {
    rounds: 10
};

exports.mailOptionsSignUp = {
    from: `App_Name <${this.mailAuth.user}>`,
    subject: `App_Name - New Account`,
    html: (url) => {
        return `<br/>Hi, \
        <br/><br/>You applied for a new account at App_Name. \
        <br/><br/><b><a href=\"${url}\">Please click here to confirm your account.</a></b> \
        <br/><br/>This will expire after two hours. \
        <br/><br/>Kind regards, \
        <br/>The App_Name team`;
    }
}

exports.mailOptionsUserInvite = {
    from: `App_Name <${this.mailAuth.user}>`,
    subject: (name) => {
        return `Invitation to ${name}`;
    },
    html: (url) => {
        return `<br/>Hi, \
        <br/><br/>You applied for a new account at App_Name. \
        <br/><br/><b><a href=\"${url}\">Please click here to confirm your account.</a></b> \
        <br/><br/>This will expire after two hours. \
        <br/><br/>Kind regards, \
        <br/>The App_Name team`;
    }
}

exports.mailOptionsPWDReset = {
    from: `App_Name <${this.mailAuth.user}>`,
    subject: `App_Name - Reset Password`,
    html: (name, url) => {
        return `<br/>Hi ${name}, \
        <br/><br/>Someone requested to a password reset for your account at App_Name. \
        <br/><br/>If this was you please click the link below to reset your password.
        <br/><br/><b><a href=\"${url}\">Please click here to reset your password.</a></b> \
        <br/><br/>Kind regards, \
        <br/>The App_Name team`;
    }
}

exports.transporterSettings = () => {

    let settings = helper.combineObject({}, exports.mailConfig);
    settings = helper.combineObject(settings, { auth: exports.mailAuth });

    return settings;
}

exports.cors = {
    allow_credentials: true,
    hosts: [
        '127.0.0.1',
        'localhost',
        'yourwebsite.com',
    ],
    origins: [
        '127.0.0.1',
        'localhost',
        'yourwebsite.com'
    ],
    methods: [
        'DELETE',
        'PUT',
        'GET',
        'POST',
        'OPTIONS'
    ],
    headers: [
        'Content-Type',
        'Accept',
        'x-access-token',
        'Lang'
    ]
}