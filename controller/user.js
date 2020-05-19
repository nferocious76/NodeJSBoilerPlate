'use strict';

const uuid          = require('uuid').v1;
const helper        = require(__dirname + '/../helper/helper.js');
const c             = require(__dirname + '/../config/constant.js');
const config        = require(__dirname + '/../config/config.js');
const util          = require(__dirname + '/../lib/util.js');

const nodemailer    = require('nodemailer');

// For encrypting and decrypting password
const bcrypt = require('bcrypt');
const bcryptConf = config.bcryptConfig;
const mailOptionsSignUp = config.mailOptionsSignUp;
const mailOptionsUserInvite = config.mailOptionsUserInvite;
const mailOptionsPWDReset = config.mailOptionsPWDReset;
const transporterSettings = config.transporterSettings();

const api_host = config.envConfig.use('api'); //solar suite server api
const web_host = config.envConfig.use('web'); //solar suite server api

// verification link for retailer registration
const api_user_confirm_registration = '/users/signup/confirmation/'; // validates token and redirects to web registration page
const user_confirm_registration = '/#/users/signup/confirmation/'; // registration page
const user_verified_success_path = '/#/users/signup/confirmation/verified/';
const user_verified_failed_path = '/#/users/signup/confirmation/error/';
const user_token_expired_path = '/#/users/signup/confirmation/expired/';

// transporter for nodemailer
// user account that will be used to send emails
const transporter = nodemailer.createTransport(transporterSettings);

module.exports = (database, auth) => {

    function signin(req, res, next) {

        function _proceed() {

            const data = req.body;

            const form = {
                email: '',
                password: ''
            };

            helper.validateBody(form, data, res, () => {
                _get_user(data);
            });
        }

        function _get_user(data) {

            database.connection((err, conn) => {
                if (err) return helper.sendConnError(res, err, c.DATABASE_CONN_ERROR);

                const fields = [
                    'u.*',
                    'u.id AS user_id',
                    'BIN_TO_UUID(u.id, 1) AS id',
                    'BIN_TO_UUID(r.id, 1) AS role_id',
                    'r.code AS role_code',
                    'r.name AS role_name',
                    'r.description AS role_description'
                ].join(', ');

                const where = [
                    'u.email = ?',
                    'u.activated = 1',
                    'u.deleted <> 1'
                ].join(' AND ');

                const query = `SELECT ${fields} FROM user u \
                    INNER JOIN role r ON r.id = u.role_id \
                    WHERE ${where}`;

                conn.query(query, [data.email], (err, rows, _) => {
                    if (err || rows.length === 0) return helper.send400(conn, res, err, c.USER_SIGNIN_FAILED);

                    _validate_password(conn, data, rows[0]);
                });
            });
        }

        function _validate_password(conn, data, record) {

            bcrypt.compare(data.password, record.password, (err, result) => {

                if (result) {
                    delete record.password;
                    _get_user_account(conn, record);
                } else {
                    helper.send400(conn, res, err, c.USER_SIGNIN_FAILED);
                }
            });
        }

        function _get_user_account(conn, record) {

            const fields = [
                'a.*',
                'BIN_TO_UUID(a.user_id, 1) AS user_id'
            ].join(', ');

            const query = `SELECT ${fields} FROM account a
                WHERE a.user_id = ?`;

            conn.query(query, [record.user_id], (err, rows, _) => {
                database.done(conn);

                delete record.user_id; // remove binary id -- used only in query
                const account = (rows && rows.length > 0) ? rows[0] : null;
                const user_data = { user: record, account: account };

                const token = _create_user_token(record, 'user_token');
                user_data.token_data = token;

                req.user_data = user_data;

                return next(); // proceed to login check
            });
        }

        function _create_user_token(record, type) {

            const payload = {
                type,
                id: record.id,
                role_id: record.role_id,
                role_code: record.role_code,
                role_name: record.role_name,
                email: record.email
            }

            return auth.createToken(payload, type);
        }

        _proceed();
    }

    function signup(req, res) {

        const uuID = uuid();

        function _proceed() {
            const data = req.body;
            data.id = uuID;

            const form = {
                id: 'uuid',
                role_id: 'uuid',
                email: '',
                password: ''
            };

            helper.validateBody(form, data, res, () => {

                database.connection((err, conn) => {
                    if (err) return helper.sendConnError(res, err, c.DATABASE_CONN_ERROR);

                    _create_user(conn, data, form);
                });
            });
        }

        function _create_user(conn, data, form) {

            exports._encrypt_password(data.password, (err, hash) => {
                if (err) return helper.send400(conn, res, err, c.USER_CREATE_FAILED);

                data.password = hash;
                const set_query = database.format(form, data);
                const query = `INSERT INTO user SET ${set_query}`;

                conn.query(query, (err, rows) => {
                    if (err) return helper.send400(conn, res, err, c.USER_CREATE_FAILED);

                    _prepare_mail(conn, data);
                });
            });
        }

        function _prepare_mail(conn, data) {

            const email = data.email;
            const type = 'registration_token';

            const payload = {
                type,
                email: email,
                id: data.id,
                role_id: data.role_id
            };

            const token = auth.createToken(payload, type).token;
            const email_validation_link = _create_email_validation_link(data, token);
            const from = mailOptionsSignUp.from;
            const subject = mailOptionsSignUp.subject;
            const html = mailOptionsSignUp.html(email_validation_link);
            const options = exports._create_mail_options(from, email, subject, html);

            transporter.sendMail(options, (err, info) => {

                if (err) {
                    const res_data = { email, err };
                    helper.send400(conn, res, res_data, c.USER_CREATE_FAILED);
                } else {
                    const res_data = { email, token, info, options };
                    helper.send200(conn, res, res_data, c.USER_CREATE_SUCCESS);
                }
            });
        }

        function _create_email_validation_link(data, token) {

            const obj = { email: data.email, role_id: data.role_id };
            const base64encode = util.encodeObj(obj);
            const url = `${api_host}${api_user_confirm_registration}${base64encode}?token=${token}`;

            return url;
        }

        _proceed();
    }

    return {
        signin,
        signup
    }
}

/**
 * @param from email sender
 * @param to email recipient
 * @param subject email subject
 * @param html email body
 */
exports._create_mail_options = (from, to, subject, html) => {

    const mail_options = {
        from, to, subject, html
    };

    return mail_options;
}

exports._encrypt_password = (password, next) => {

    bcrypt.genSalt(bcryptConf.rounds, (err, salt) => {
        if (err) { return next(err, null); }

        bcrypt.hash(password, salt, (err, hash) => {
            if (err) { return next(err, null); }

            next(null, hash);
        });
    });
}