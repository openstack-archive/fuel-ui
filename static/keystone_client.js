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
import $ from 'jquery';
import _ from 'underscore';

class KeystoneClient {
  constructor(url) {
    this.url = url;
  }

  request(url, options = {}) {
    return $.ajax(
      this.url + url,
      _.extend({}, {
        dataType: 'json',
        contentType: 'application/json'
      }, options)
    );
  }

  authenticate({username, password, projectName, userDomainName, projectDomainName}) {
    if (this.tokenIssueRequest) return this.tokenIssueRequest;

    if (!(username && password)) return $.Deferred().reject();

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
      type: 'POST',
      data: JSON.stringify(data)
    }).then((response, status, request) => {
      return request.getResponseHeader('x-subject-token');
    })
    .always(() => delete this.tokenIssueRequest);

    return this.tokenIssueRequest;
  }

  getTokenInfo(token) {
    return this.request('/v3/auth/tokens', {
      type: 'GET',
      headers: {
        'X-Subject-Token': token,
        'X-Auth-Token': token
      }
    });
  }

  changePassword(token, userId, currentPassword, newPassword) {
    var data = {
      user: {
        password: newPassword,
        original_password: currentPassword
      }
    };

    return this.request('/v3/users/' + userId + '/password', {
      type: 'POST',
      data: JSON.stringify(data),
      headers: {'X-Auth-Token': this.token}
    }).then((response) => {
      return response.headers.get('X-Subject-Token');
    });
  }

  deauthenticate(token) {
    if (this.tokenIssueRequest) return this.tokenIssueRequest;
    if (!token) return $.Deferred().reject();

    this.tokenRemoveRequest = this.request('/v3/auth/tokens', {
      type: 'DELETE',
      headers: {
        'X-Auth-Token': token,
        'X-Subject-Token': token
      }
    })
    .always(() => delete this.tokenRemoveRequest);

    return this.tokenRevokeRequest;
  }
}

export default KeystoneClient;
