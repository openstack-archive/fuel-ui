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

import _ from 'underscore';
import React from 'react';
import ReactTestUtils from 'react-addons-test-utils';
import {MultiSelectControl} from 'views/controls';

var renderControl;

suite('Multiselect Control', () => {
  setup(() => {
    renderControl = (props) => ReactTestUtils.renderIntoDocument(
      <MultiSelectControl
        {...props}
        name='multiselect'
        label='Label For Multiselect'
        options={_.times(11, (n) => ({name: 'option' + n, title: 'option' + n}))}
        onChange={sinon.spy()}
        toggle={sinon.spy()}
      />
    );
  });

  test('Test control render', () => {
    var control1 = renderControl();
    assert.equal(
      ReactTestUtils.scryRenderedDOMComponentsWithClass(control1, 'popover').length,
      0,
      'Popover with the options is closed by default'
    );
    assert.equal(
      ReactTestUtils.findRenderedDOMComponentWithClass(control1, 'dropdown-toggle').textContent,
      'Label For Multiselect ',
      'Control label is rendered properly if no values chosen'
    );
    assert.equal(
      ReactTestUtils.scryRenderedDOMComponentsWithClass(control1, 'btn-default').length,
      1,
      'Filter is rendered as default button'
    );

    var control2 = renderControl({values: ['option2', 'option3']});
    assert.equal(
      ReactTestUtils.findRenderedDOMComponentWithClass(control2, 'dropdown-toggle').textContent,
      'Label For Multiselect: option2, option3 ',
      'Selected values are shown in label'
    );

    var control3 = renderControl({values: ['option2', 'option3', 'option4', 'option5']});
    assert.equal(
      ReactTestUtils.findRenderedDOMComponentWithClass(control3, 'dropdown-toggle').textContent,
      'Label For Multiselect: 4 selected ',
      'Number of selected values is shown in label if there are more than 3 values selected'
    );
  });

  test('Test choosing values', () => {
    var control = renderControl({isOpen: true, values: ['option1']});
    assert.equal(control.refs.option1.refs.input.checked, true, 'option1 is chosen');

    control.refs.option2.refs.input.checked = true;
    ReactTestUtils.Simulate.change(control.refs.option2.refs.input);
    assert.deepEqual(
      control.props.onChange.args[0][0], ['option1', 'option2'], 'option1 and option2 are chosen'
    );
    control.refs.option1.refs.input.checked = false;
    ReactTestUtils.Simulate.change(control.refs.option1.refs.input);
    assert.deepEqual(control.props.onChange.args[1][0], [], 'No chosen option');
    control.refs.all.refs.input.checked = true;
    ReactTestUtils.Simulate.change(control.refs.all.refs.input);
    assert.deepEqual(
      control.props.onChange.args[2][0], _.times(11, (n) => 'option' + n), 'all values are chosen'
    );
    control.refs.all.refs.input.checked = false;
    ReactTestUtils.Simulate.change(control.refs.all.refs.input);
    assert.deepEqual(
      control.props.onChange.args[3][0], [], 'values selection is reset'
    );
  });

  test('Test filtering options', () => {
    var control = renderControl({isOpen: true, addOptionsFilter: true});
    assert.equal(
      ReactTestUtils.scryRenderedDOMComponentsWithClass(control, 'checkbox-group').length,
      12,
      'All options presented by default'
    );
    var optionsFilter = control.refs.optionsFilter.refs.input;
    optionsFilter.value = 'option4';
    ReactTestUtils.Simulate.change(optionsFilter);
    assert.equal(
      ReactTestUtils.scryRenderedDOMComponentsWithClass(control, 'checkbox-group').length,
      2,
      'Just one option matches the filter'
    );
  });

  test('Test dynamic values control', () => {
    var control1 = renderControl({dynamicValues: true});
    assert.equal(
      ReactTestUtils.scryRenderedDOMComponentsWithClass(control1, 'btn-link').length,
      1,
      'Filter is rendered as "link" style button'
    );
    var control2 = renderControl({isOpen: true, dynamicValues: true});
    assert.equal(
      ReactTestUtils.scryRenderedDOMComponentsWithClass(control2, 'btn-link').length,
      0,
      'Open filter is rendered as default button'
    );
    assert.equal(
      ReactTestUtils.scryRenderedDOMComponentsWithClass(control2, 'select-all-options').length,
      0,
      'No "Select All" checkbox for the control with dynamic values'
    );
  });
});
