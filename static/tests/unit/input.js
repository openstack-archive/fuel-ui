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
import {Input} from 'views/controls';

var input, input1, input2;

suite('Text input', () => {
  setup(() => {
    var renderControl = function(value, error, extraContent) {
      return ReactTestUtils.renderIntoDocument(
        <Input
          name='some_name'
          defaultValue={value}
          label='Some label'
          description='Some description'
          onChange={sinon.spy()}
          error={error || null}
          extraContent={extraContent}
        />
      );
    };
    input1 = renderControl('val1', null, <div className='extraContent'>123</div>);
    input2 = renderControl('val2', 'Invalid data');
  });

  test('Test input render', () => {
    assert.equal(
      ReactTestUtils.findRenderedDOMComponentWithTag(input1, 'input').value,
      'val1',
      'Input has proper initial value'
    );
    assert.equal(
      ReactTestUtils.findRenderedDOMComponentWithTag(input1, 'label').textContent,
      'Some label',
      'Input label is shown'
    );
    assert.equal(
      ReactTestUtils.findRenderedDOMComponentWithClass(input1, 'help-block').textContent,
      'Some description',
      'Input description is shown'
    );
    assert.equal(
      ReactTestUtils.findRenderedDOMComponentWithClass(input2, 'help-block').textContent,
      'Invalid data',
      'Input error is shown instead of description for input with invalid value'
    );
    assert.equal(
      ReactTestUtils.findRenderedDOMComponentWithClass(input1, 'extraContent').textContent,
      '123',
      'Extra content is show'
    );
  });

  test('Test input value change', () => {
    var input = input1.refs.input;
    input.value = 'val1_new';
    ReactTestUtils.Simulate.change(input);
    assert.equal(input1.props.onChange.args[0][1], 'val1_new', 'Input value is changed');
  });
});

suite('Password input', () => {
  setup(() => {
    var renderControl = function(disabled) {
      return ReactTestUtils.renderIntoDocument(
        <Input
          type='password'
          toggleable
          name='some_name'
          defaultValue='val1'
          onChange={sinon.spy()}
          disabled={disabled}
        />
      );
    };
    input1 = renderControl(false);
    input2 = renderControl(true);
  });

  test('Test password content visibility', () => {
    var input = input1.refs.input;
    assert.equal(input.type, 'password', 'Input content is hidden');
    var togglePasswordButton1 = ReactTestUtils
      .findRenderedDOMComponentWithClass(input1, 'glyphicon-eye-open');
    ReactTestUtils.Simulate.click(togglePasswordButton1);
    assert.equal(input.type, 'text', 'Input content is visible');
    assert.ok(
      ReactTestUtils.findRenderedDOMComponentWithClass(input1, 'glyphicon-eye-close'),
      'Toggle password button has a proper icon'
    );
    var togglePasswordButton2 = ReactTestUtils
      .findRenderedDOMComponentWithClass(input2, 'glyphicon-eye-open');
    ReactTestUtils.Simulate.click(togglePasswordButton2);
    assert.equal(
      input2.refs.input.type,
      'text',
      'Content visibility can be toggled for disabled input also'
    );
  });
});

suite('Checkbox input', () => {
  setup(() => {
    input1 = ReactTestUtils.renderIntoDocument(
      <Input
        type='checkbox'
        name='some_name'
        defaultValue
        label='Some label'
        onChange={sinon.spy()}
      />
    );
  });

  test('Test input render', () => {
    assert.ok(
      ReactTestUtils.findRenderedDOMComponentWithClass(input1, 'custom-tumbler'),
      'Checkbox input has different layout'
    );
  });
});

suite('Hidden input', () => {
  setup(() => {
    input1 = ReactTestUtils.renderIntoDocument(
      <Input
        type='hidden'
        name='some_name'
        defaultValue='Some value'
        label='Some label'
        description='Some description'
        onChange={sinon.spy()}
      />
    );
  });

  test('Test input render', () => {
    assert.equal(
      ReactTestUtils.findRenderedDOMComponentWithTag(input1, 'label').textContent,
      'Some label',
      'Input label is shown'
    );
    assert.equal(
      ReactTestUtils.findRenderedDOMComponentWithClass(input1, 'help-block').textContent,
      'Some description',
      'Input description is shown'
    );
  });
});

suite('File Control', () => {
  setup(() => {
    input = new Input({
      type: 'file',
      name: 'some_file',
      label: 'Please select some file',
      description: 'File should be selected from the local disk',
      disabled: false,
      onChange: sinon.spy(),
      defaultValue: {
        name: 'certificate.crt',
        content: 'CERTIFICATE'
      }
    });
  });

  test('Initialization', () => {
    var initialState = input.getInitialState();

    assert.equal(input.props.type, 'file', 'Input type should be equal to file');
    assert.equal(initialState.fileName, 'certificate.crt',
      'Default file name must correspond to provided one');
    assert.equal(initialState.content, 'CERTIFICATE', 'Content should be equal to the default');
  });

  test('File selection', () => {
    var clickSpy = sinon.spy();

    sinon.stub(input, 'getInputDOMNode').returns({
      click: clickSpy
    });

    input.pickFile();
    assert.ok(clickSpy.calledOnce,
      'When icon clicked input control should be clicked too to open select file dialog');
  });

  test('File fetching', () => {
    var readMethod = sinon.mock();
    var readerObject = {
      readAsBinaryString: readMethod,
      result: 'File contents'
    };
    var saveMethod = sinon.spy(input, 'saveFile');

    window.FileReader = () => readerObject;

    sinon.stub(input, 'getInputDOMNode').returns({
      value: '/dummy/path/to/somefile.ext',
      files: ['file1']
    });

    input.readFile();

    assert.ok(readMethod.calledOnce, 'File reading as binary expected to be executed once');
    sinon.assert.calledWith(readMethod, 'file1');

    readerObject.onload();
    assert.ok(saveMethod.calledOnce, 'saveFile handler called once');
    sinon.assert.calledWith(saveMethod, 'somefile.ext', 'File contents');
  });

  test('File saving', () => {
    var setState = sinon.spy(input, 'setState');
    var dummyName = 'dummy.ext';
    var dummyContent = 'Lorem ipsum dolores';
    input.saveFile(dummyName, dummyContent);

    assert.deepEqual(setState.args[0][0], {
      fileName: dummyName,
      content: dummyContent
    }, 'Save file must update control state with data supplied');

    assert.deepEqual(input.props.onChange.args[0][1], {
      name: dummyName,
      content: dummyContent
    }, 'Control sends updated data upon changes');
  });
});
