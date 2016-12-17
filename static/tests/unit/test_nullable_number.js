/*
 * Copyright 2016 Mirantis, Inc.
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

import React from 'react';
import ReactTestUtils from 'react-addons-test-utils';
import customControls from 'views/custom_controls';

var control1, control2, control3;

suite('Nullable Number Control', () => {
  setup(() => {
    var renderControl = function(value, error) {
      return ReactTestUtils.renderIntoDocument(
        <customControls.nullable_number
          type='nullable_number'
          name='some_name'
          value={value}
          label='Some label'
          description='Some description'
          disabled={false}
          onChange={sinon.spy()}
          error={error || null}
          min={2}
          max={4}
        />
      );
    };
    control1 = renderControl(null);
    control2 = renderControl(2);
    control3 = renderControl('', 'Invalid value');
  });

  test('Test control render', () => {
    assert.equal(
      ReactTestUtils.scryRenderedDOMComponentsWithTag(control1, 'input').length,
      2,
      'Two inputs are rendered'
    );
    assert.equal(
      ReactTestUtils.scryRenderedDOMComponentsWithClass(control1, 'description').length,
      1,
      'Control description is shown'
    );
    assert.equal(
      control1.refs.number.refs.input.disabled,
      true,
      'Number input is locked if control value is null'
    );
    assert.equal(
      control1.refs.checkbox.refs.input.checked,
      false,
      'Checkbox input is unchecked if control value is null'
    );
    assert.equal(
      control2.refs.number.refs.input.disabled,
      false,
      'Number input is not locked if control value is a number'
    );
    assert.equal(
      control2.refs.checkbox.refs.input.checked,
      true,
      'Checkbox input is checked if control value is a number'
    );
    assert.equal(
      ReactTestUtils.scryRenderedDOMComponentsWithClass(control3, 'has-error').length,
      1,
      'Validation error is shown for control input'
    );
  });
});
