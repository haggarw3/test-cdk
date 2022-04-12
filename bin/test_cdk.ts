#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { TestCdkStack } from '../lib/test_cdk-stack';

const app = new cdk.App();
new TestCdkStack(app, 'TestCdkStack');
