/*
 * Copyright 2015 Mirantis, Inc.
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
import OffloadingModes from
  'views/cluster_page_tabs/nodes_tab_screens/offloading_modes_control';
import models from 'models';
import utils from 'utils';

var offloadingModesConrol, TestMode22, TestMode31, fakeOffloadingModes, fakeAttributes;
var getModeState = (name) =>
    fakeAttributes.get(utils.makePath('offloading.modes.value', name));


suite('Offloading Modes control', () => {
  setup(() => {
    fakeAttributes = new models.InterfaceAttributes({
      offloading: {
        modes: {
          value: {
            TestName1: true,
            TestName11: true,
            TestName31: null,
            TestName12: false,
            TestName13: null,
            TestName2: false,
            TestName21: false,
            TestName22: false,
            TestName23: false
          }
        }
      }
    });
    TestMode22 = {name: 'TestName22', sub: []};
    TestMode31 = {name: 'TestName31', sub: []};
    fakeOffloadingModes = [
      {
        name: 'TestName1',
        sub: [
          {name: 'TestName11', sub: [
            TestMode31
          ]},
          {name: 'TestName12', sub: []},
          {name: 'TestName13', sub: []}
        ]
      },
      {
        name: 'TestName2',
        sub: [
          {name: 'TestName21', sub: []},
          TestMode22,
          {name: 'TestName23', sub: []}
        ]
      }
    ];
    offloadingModesConrol = new OffloadingModes({
      attributes: fakeAttributes,
      offloadingModesMeta: fakeOffloadingModes
    });
  });

  test('Finding mode by name', () => {
    var mode = offloadingModesConrol.findMode(TestMode22.name, fakeOffloadingModes);
    assert.deepEqual(mode, TestMode22, 'Mode can be found by name');
  });
  test('Set mode state logic', () => {
    offloadingModesConrol.setModeState(TestMode31, true);
    assert.strictEqual(getModeState(TestMode31.name), true, 'Mode state is changing');
  });
  test('Set submodes states logic', () => {
    var mode = offloadingModesConrol.findMode('TestName1', fakeOffloadingModes);
    offloadingModesConrol.setModeState(mode, false);
    assert.strictEqual(getModeState(TestMode31.name), false,
      'Parent state changing leads to all child modes states changing');
  });
  test('Disabled reversed logic', () => {
    offloadingModesConrol.setModeState(TestMode22, true);
    offloadingModesConrol.checkModes(null, fakeOffloadingModes);
    assert.strictEqual(getModeState('TestName2'), false,
      'Parent state changing leads to all child modes states changing');
  });
  test('All Modes option logic', () => {
    var enableAllModes = offloadingModesConrol.onModeStateChange('All Modes', true);
    enableAllModes();
    assert.strictEqual(getModeState('TestName2'), true,
      'All Modes option state changing leads to all parent modes states changing');
  });
});
