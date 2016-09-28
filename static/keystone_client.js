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

class KeystoneClient {
  constructor(url) {
    this.url = url;
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

    this.tokenIssueRequest = $.ajax(this.url + '/v3/auth/tokens', {
      type: 'POST',
      dataType: 'json',
      contentType: 'application/json',
      data: JSON.stringify(data)
    }).then((response) => {
      return response.headers.get('X-Subject-Token');
    })
    .always(() => delete this.tokenIssueRequest);

    return this.tokenIssueRequest;
  }

  getTokenInfo(token) {
    return $.ajax(this.url + '/v3/auth/tokens', {
      type: 'GET',
      dataType: 'json',
      contentType: 'application/json',
      headers: {
        'X-Subject-Token': token,
        'X-Auth-Token': token
      }
    })
    .then((response) => response.json());
  }

  changePassword(token, userId, currentPassword, newPassword) {
    var data = {
      user: {
        password: newPassword,
        original_password: currentPassword
      }
    };

    return $.ajax(this.url + '/v3/users/' + userId + '/password', {
      type: 'POST',
      dataType: 'json',
      contentType: 'application/json',
      data: JSON.stringify(data),
      headers: {'X-Auth-Token': this.token}
    }).then((response) => {
      return response.headers.get('X-Subject-Token');
    });
  }

  deauthenticate(token) {
    if (this.tokenIssueRequest) return this.tokenIssueRequest;
    if (!token) return $.Deferred().reject();

    this.tokenRemoveRequest = $.ajax(this.url + '/v3/auth/tokens', {
      type: 'DELETE',
      dataType: 'json',
      contentType: 'application/json',
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
