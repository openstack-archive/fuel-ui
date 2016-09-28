/*
 * Copyright 2014 Mirantis, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License. You may obtain
 * a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
**/
import _ from 'underscore';

class KeystoneClient {
  constructor(url, options) {
    _.extend(this, {
      url: url,
      cacheTokenFor: 10 * 60 * 1000
    }, options);
  }

  request(url, options = {}) {
    options.headers = new Headers(_.extend({}, {
      'Content-Type': 'application/json'
    }, options.headers));
    return fetch(this.url + url, options).then((response) => {
      if (!response.ok) throw response;
      return response;
    });
  }

  authenticate(username, password, options = {}) {
    if (this.tokenUpdatePromise) return this.tokenUpdatePromise;

    if (
      !options.force &&
      this.tokenUpdateTime &&
      (this.cacheTokenFor > (new Date() - this.tokenUpdateTime))
    ) {
      return Promise.resolve();
    }
    var data = {auth: {identity: {}}};
    if (username && password) {
      data.auth.identity.methods = ['password'];
      data.auth.identity.password = {
        user: {
          name: username,
          password: password,
          domain: {name: 'fuel'}
        }
      };
    } else if (this.token) {
      data.auth.identity.methods = ['token'];
      data.auth.identity.token = {id: this.token};
    } else {
      return Promise.reject();
    }
    if (this.project) {
      data.auth.scope = {
        project: {
          name: this.project,
          domain: {name: 'fuel'}
        }
      };
    }
    this.tokenUpdatePromise = this.request('/v3/auth/tokens', {
      method: 'POST',
      body: JSON.stringify(data)
    }).then((response) => {
      this.token = response.headers.get('X-Subject-Token');
      this.tokenUpdateTime = new Date();
      return response.json();
    }).then((body) => {
      this.userId = body.token.user.id;
      this.userRoles = body.token.roles;
    });

    this.tokenUpdatePromise
      .catch(() => delete this.tokenUpdateTime)
      .then(() => delete this.tokenUpdatePromise);

    return this.tokenUpdatePromise;
  }

  changePassword(currentPassword, newPassword) {
    var data = {
      user: {
        password: newPassword,
        original_password: currentPassword
      }
    };
    return this.request('/v3/users/' + this.userId + '/password', {
      method: 'POST',
      headers: {
        'X-Auth-Token': this.token
      },
      body: JSON.stringify(data)
    }).then((response) => {
      this.token = response.headers.get('X-Subject-Token');
      this.tokenUpdateTime = new Date();
    });
  }

  deauthenticate() {
    var token = this.token;

    if (this.tokenUpdatePromise) return this.tokenUpdatePromise;
    if (!token) return Promise.reject();

    delete this.userId;
    delete this.userRoles;
    delete this.token;
    delete this.tokenUpdateTime;

    this.tokenRemoveRequest = this.request('/v3/auth/tokens', {
      method: 'DELETE',
      headers: {
        'X-Auth-Token': token,
        'X-Subject-Token': token
      }
    });

    this.tokenRemoveRequest
      .catch(() => true)
      .then(() => delete this.tokenRemoveRequest);

    return this.tokenRemoveRequest;
  }
}

export default KeystoneClient;
