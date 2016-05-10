/*
 * Copyright 2016 Mirantis, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License'); you may
 * not use this file except in compliance with the License. You may obtain
 * a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 **/

import fs from 'intern/dojo/node!fs';
import 'tests/functional/helpers';

class HealthcheckPage {
  constructor(remote) {
    this.remote = remote;

    ['tests', 'testsets', 'testruns_running', 'testruns_finished'].forEach((fixture) => {
      this[fixture] = JSON.parse(
        fs.readFileSync('../../../fixtures/' + fixture + '.json')  // eslint-disable-line no-sync
      );
    });
  }

  createFakeServer(testRunsResponse = []) {
    return this.remote
      .execute((testsets, tests, testRunsResponse) => {
        window.server = sinon.fakeServer.create();
        window.server.autoRespond = true;
        window.server.respondWith('GET', /\/ostf\/testsets\/.*/, [
          200, {'Content-Type': 'application/json'},
          // @FIXME(morale): multiple testsets don't seem to work as expected
          JSON.stringify(testsets)
        ]);
        window.server.respondWith('GET', /\/ostf\/tests\/.*/, [
          200, {'Content-Type': 'application/json'},
          JSON.stringify(tests)
        ]);
        window.server.respondWith('GET', /\ostf\/testruns\/last.*/, [
          200, {'Content-Type': 'application/json'},
          JSON.stringify(testRunsResponse)
        ]);
      },
      [this.testsets, this.tests, testRunsResponse]
    );
  }

  createFakeServerForNoExecutedTests() {
    return this.createFakeServer();
  }

  createFakeServerForRunningTests() {
    return this.createFakeServer(this.testruns_running);
  }

  createFakeServerForFinishedTests() {
    return this.createFakeServer(this.testruns_finished);
  }

  restoreServer() {
    return this.remote
      .execute(() => {
        window.server.restore();
      }
    );
  }
}

export default HealthcheckPage;
