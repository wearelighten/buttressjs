'use strict';

/**
 * Rhizome - The API that feeds grassroots movements
 *
 * @file person.js
 * @description Person API specification
 * @module API
 * @author Chris Bates-Keegan
 *
 */

var Route = require('../route');
var Model = require('../../model');
var Logging = require('../../logging');
var Helpers = require('../../helpers');

var routes = [];

/**
 * @class GetUserList
 */
class GetUserList extends Route {
  constructor() {
    super('user', 'GET USER LIST');
    this.verb = Route.Constants.Verbs.GET;
    this.auth = Route.Constants.Auth.ADMIN;
    this.permissions = Route.Constants.Permissions.LIST;
  }

  _validate() {
    return Promise.resolve(true);
  }

  _exec() {
    return Model.User.getAll();
  }
}
routes.push(GetUserList);

/**
 * @class GetUser
 */
class GetUser extends Route {
  constructor() {
    super('user/:id', 'GET USER');
    this.verb = Route.Constants.Verbs.GET;
    this.auth = Route.Constants.Auth.ADMIN;
    this.permissions = Route.Constants.Permissions.READ;

    this._user = false;
  }

  _validate() {
    return new Promise((resolve, reject) => {
      if (!this.req.params.id) {
        this.log('ERROR: Missing required field', Route.LogLevel.ERR);
        reject({statusCode: 400});
        return;
      }
      Model.User.findById(this.req.params.id).then(user => {
        if (!user) {
          this.log('ERROR: Invalid User ID', Route.LogLevel.ERR);
          reject({statusCode: 400});
          return;
        }

        this._user = user;
        resolve(true);
      });
    });
  }

  _exec() {
    return Promise.resolve(this._user.details);
  }
}
routes.push(GetUser);

/**
 * @class FindUser
 */
class FindUser extends Route {
  constructor() {
    super('user/:app(twitter|facebook|google)/:id', 'FIND USER');
    this.verb = Route.Constants.Verbs.GET;
    this.auth = Route.Constants.Auth.ADMIN;
    this.permissions = Route.Constants.Permissions.READ;

    this._user = false;
  }

  _validate() {
    return new Promise((resolve, reject) => {
      Model.User.getByAppId(this.req.params.app, this.req.params.id).then(user => {
        Logging.log(`User: ${user}`, Logging.Constants.LogLevel.DEBUG);
        this._user = user;
        resolve(true);
      });
    });
  }

  _exec() {
    return Promise.resolve(this._user ? {id: this._user.id} : false);
  }
}
routes.push(FindUser);

/**
 * @class UpdateUserToken
 */
class UpdateUserToken extends Route {
  constructor() {
    super('user/:id/:app(twitter|facebook|google)/token', 'UPDATE USER APP TOKEN');
    this.verb = Route.Constants.Verbs.PUT;
    this.auth = Route.Constants.Auth.ADMIN;
    this.permissions = Route.Constants.Permissions.READ;

    this._user = false;
  }

  _validate() {
    return new Promise((resolve, reject) => {
      if (!this.req.body ||
        !this.req.body.token ||
        !this.req.body.tokenSecret) {
        this.log('ERROR: Missing required field', Route.LogLevel.ERR);
        reject({statusCode: 400});
        return;
      }

      Model.User.findById(this.req.params.id).select('-metadata').then(user => {
        Logging.log(`User: ${user ? user.id : null}`, Logging.Constants.LogLevel.DEBUG);
        this._user = user;
        if (this._user) {
          resolve(true);
        } else {
          this.log('ERROR: Invalid User ID', Route.LogLevel.ERR);
          resolve({statusCode: 400});
        }
      });
    });
  }

  _exec() {
    return this._user.updateToken(this.req.params.app, this.req.body);
  }
}
routes.push(UpdateUserToken);

/**
 * @class AddUser
 */
class AddUser extends Route {
  constructor() {
    super('user', 'ADD USER');
    this.verb = Route.Constants.Verbs.POST;
    this.auth = Route.Constants.Auth.ADMIN;
    this.permissions = Route.Constants.Permissions.ADD;
  }

  _validate() {
    return new Promise((resolve, reject) => {
      Logging.log(this.req.body, Logging.Constants.LogLevel.DEBUG);

      if (!this.req.body.username ||
          !this.req.body.app ||
          !this.req.body.id ||
          !this.req.body.token ||
          !this.req.body.tokenSecret ||
          !this.req.body.profileUrl ||
          !this.req.body.profileImgUrl ||
          !this.req.body.bannerImgUrl) {
        this.log('ERROR: Missing required field', Route.LogLevel.ERR);
        reject({statusCode: 400});
        return;
      }

      resolve(true);
    });
  }

  _exec() {
    return new Promise((resolve, reject) => {
      Model.User.add(this.req.body)
        .then(Logging.Promise.logProp('Added User', 'username', Route.LogLevel.VERBOSE))
        .then(Helpers.Promise.prop('details'))
        .then(resolve, reject);
    });
  }
}
routes.push(AddUser);

/**
 * @class DeleteUser
 */
class DeleteUser extends Route {
  constructor() {
    super('user/:id', 'DELETE USER');
    this.verb = Route.Constants.Verbs.DEL;
    this.auth = Route.Constants.Auth.ADMIN;
    this.permissions = Route.Constants.Permissions.DELETE;
    this._user = false;
  }

  _validate() {
    return new Promise((resolve, reject) => {
      if (!this.req.params.id) {
        this.log('ERROR: Missing required field', Route.LogLevel.ERR);
        reject({statusCode: 400});
        return;
      }
      Model.User.findById(this.req.params.id).select('-metadata').then(user => {
        if (!user) {
          this.log('ERROR: Invalid User ID', Route.LogLevel.ERR);
          reject({statusCode: 400});
          return;
        }
        this._user = user;
        resolve(true);
      });
    });
  }

  _exec() {
    return Model.User.rm(this._user).then(() => true);
  }
}
routes.push(DeleteUser);

/**
 * @class AddUserMetadata
 */
class AddUserMetadata extends Route {
  constructor() {
    super('user/:id/metadata/:key', 'ADD USER METADATA');
    this.verb = Route.Constants.Verbs.POST;
    this.auth = Route.Constants.Auth.ADMIN;
    this.permissions = Route.Constants.Permissions.ADD;

    this._user = false;
  }

  _validate() {
    return new Promise((resolve, reject) => {
      Model.User.findById(this.req.params.id).then(user => {
        if (!user) {
          this.log('ERROR: Invalid User ID', Route.LogLevel.ERR);
          reject({statusCode: 400});
          return;
        }
        try {
          JSON.parse(this.req.body.value);
        } catch (e) {
          this.log(`ERROR: ${e.message}`, Route.LogLevel.ERR);
          this.log(this.req.body.value, Route.LogLevel.ERR);
          reject({statusCode: 400});
          return;
        }

        this._user = user;
        resolve(true);
      });
    });
  }

  _exec() {
    return this._user.addOrUpdateMetadata(this.req.params.key, this.req.body.value);
  }
}
routes.push(AddUserMetadata);

/**
 * @class UpdateUserMetadata
 */
class UpdateUserMetadata extends Route {
  constructor() {
    super('user/:id/metadata/:key', 'UPDATE USER METADATA');
    this.verb = Route.Constants.Verbs.PUT;
    this.auth = Route.Constants.Auth.ADMIN;
    this.permissions = Route.Constants.Permissions.ADD;

    this._app = false;
  }

  _validate() {
    return new Promise((resolve, reject) => {
      Model.User.findById(this.req.params.id).then(user => {
        if (!user) {
          this.log('ERROR: Invalid App ID', Route.LogLevel.ERR);
          reject({statusCode: 400});
          return;
        }
        if (user.findMetadata(this.req.params.key) === false) {
          this.log('ERROR: Metadata does not exist', Route.LogLevel.ERR);
          reject({statusCode: 400});
          return;
        }
        try {
          JSON.parse(this.req.body.value);
        } catch (e) {
          this.log(`ERROR: ${e.message}`, Route.LogLevel.ERR);
          reject({statusCode: 400});
          return;
        }

        this._user = user;
        resolve(true);
      });
    });
  }

  _exec() {
    return this._user.addOrUpdateMetadata(this.req.params.key, this.req.body.value);
  }
}
routes.push(UpdateUserMetadata);

/**
 * @class GetUserMetadata
 */
class GetUserMetadata extends Route {
  constructor() {
    super('user/:id/metadata/:key', 'GET USER METADATA');
    this.verb = Route.Constants.Verbs.GET;
    this.auth = Route.Constants.Auth.ADMIN;
    this.permissions = Route.Constants.Permissions.GET;

    this._metadata = false;
  }

  _validate() {
    return new Promise((resolve, reject) => {
      Model.User.findById(this.req.params.id).then(user => {
        if (!user) {
          this.log('ERROR: Invalid User ID', Route.LogLevel.ERR);
          reject({statusCode: 400});
          return;
        }

        this._metadata = user.findMetadata(this.req.params.key);
        if (this._metadata === undefined) {
          this.log('WARN: App Metadata Not Found', Route.LogLevel.ERR);
          reject({statusCode: 404});
          return;
        }

        resolve(true);
      });
    });
  }

  _exec() {
    return this._metadata.value;
  }
}
routes.push(GetUserMetadata);

/**
 * @type {*[]}
 */
module.exports = routes;