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
  constructor(url) {
    this.url = url;
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

  authenticate({username, password, projectName, userDomainName, projectDomainName}) {
    if (this.tokenIssueRequest) return this.tokenIssueRequest;

    if (!(username && password)) return Promise.reject();

    var data = {
      auth: {
        identity: {
          methods: ['password'],
          password: {
            user: {
              name: username,
              password: password,
              domain: {name: userDomainName}
            }
          }
        }
      }
    };
    if (projectName) {
      data.auth.scope = {
        project: {
          name: projectName,
          domain: {name: projectDomainName}
        }
      };
    }

    this.tokenIssueRequest = this.request('/v3/auth/tokens', {
      method: 'POST',
      body: JSON.stringify(data)
    }).then((response) => {
      return response.headers.get('X-Subject-Token');
    });

    this.tokenIssueRequest
      .catch(() => true)
      .then(() => delete this.tokenIssueRequest);

    return this.tokenIssueRequest;
  }

  getTokenInfo(token) {
    return this.request('/v3/auth/tokens', {
      method: 'GET',
      headers: {
        'X-Subject-Token': token,
        'X-Auth-Token': token
      }
    }).then((response) => response.json());
  }

  changePassword(token, userId, currentPassword, newPassword) {
    var data = {
      user: {
        password: newPassword,
        original_password: currentPassword
      }
    };
    return this.request('/v3/users/' + userId + '/password', {
      method: 'POST',
      headers: {
        'X-Auth-Token': token
      },
      body: JSON.stringify(data)
    }).then((response) => {
      return response.headers.get('X-Subject-Token');
    });
  }

  deauthenticate(token) {
    if (this.tokenRevokeRequest) return this.tokenRevokeRequest;
    if (!token) return Promise.reject();

    this.tokenRevokeRequest = this.request('/v3/auth/tokens', {
      method: 'DELETE',
      headers: {
        'X-Auth-Token': token,
        'X-Subject-Token': token
      }
    });

    this.tokenRevokeRequest
      .catch(() => true)
      .then(() => delete this.tokenRevokeRequest);

    return this.tokenRevokeRequest;
  }
}

export default KeystoneClient;
