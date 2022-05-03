import * as cdk from 'aws-cdk-lib';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { aws_glue as glue } from 'aws-cdk-lib';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as events from 'aws-cdk-lib/aws-events';          // additional modules imported
import * as targets from 'aws-cdk-lib/aws-events-targets'; // additional modules imported
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as athena from 'aws-cdk-lib/aws-athena';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as iam from 'aws-cdk-lib/aws-iam';
import { constants } from 'os';
import { Subscription } from 'aws-cdk-lib/aws-sns';

import * as ssm from 'aws-cdk-lib/aws-ssm';

export class TestCdkStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string) {
    super(scope, id);

    const username = new ssm.StringParameter(this, 'test-username', {
      parameterName: 'database-username',
      stringValue: 'awsuser',
      description: 'the username for redshift',
      type: ssm.ParameterType.STRING,
      tier: ssm.ParameterTier.STANDARD, // ADVANCED parameters let us store values of up to 8KB, compared to 4KB with STANDARD parameters
      allowedPattern: '.*', //a regular expression that validates the provided parameter value
    });

    const password = new ssm.StringParameter(this, 'test-password', {
      parameterName: 'database-password',
      stringValue: 'AWSUser5439',
      description: 'the password for redshift',
      type: ssm.ParameterType.STRING,
      tier: ssm.ParameterTier.ADVANCED, //ADVANCED parameters let us store values of up to 8KB, compared to 4KB with STANDARD parameters
      allowedPattern: '.*', // a regular expression that validates the provided parameter value
    });


    const importedParam_username =
      ssm.StringParameter.fromStringParameterAttributes(
        this,
        'imported-username',
        {parameterName: 'database-password', version: 1},
      );

    const importedParam_password =
    ssm.StringParameter.fromStringParameterAttributes(
      this,
      'imported-password',
      {parameterName: 'database-username', version: 1},
    );

    const imported_secure_Param_password =
    ssm.StringParameter.fromSecureStringParameterAttributes(
      this,
      'imported-secure-password',
      {parameterName: 'test-redshift-username', version: 1},
    );



    const startQueryExecutionJob_create_table_billing_requirement = 
    new tasks.AthenaStartQueryExecution(this, 'Athena Query Test', {
    workGroup: 'primary',  
    queryString: sfn.JsonPath.format('select * from '),
    queryExecutionContext: {
      databaseName: 'core_profile_cdk',
    },
    resultConfiguration: {
      encryptionConfiguration: {
        encryptionOption: tasks.EncryptionOption.S3_MANAGED,
      },
      outputLocation: {
        bucketName: 'core_profile_cdk',
      objectKey: 'billing_requirement',
      },
    },
    integrationPattern: sfn.IntegrationPattern.RUN_JOB,
    });

// crawler definition
    const crawler_test_cdk = new glue.CfnCrawler(this, 'crawler_test_cdk_for_sns', {
      role: 'arn:aws:iam::464340339497:role/service-role/AWSGlueServiceRole-Datalake',
      targets: {
        // this is the path to source data in core profile dev account
        s3Targets: [{
          path: 's3://so/'
        }],
      },
      databaseName: 'core_profile_cdk',
      description: 'This is the crawler to read the schema of the source data from core profile dev account',
      // Note: This is the name of the crawler that is created in AWS console
      name: 'crawler_test_cdk_for_sns',
      // TO DO
      // schedule: {
      //   scheduleExpression: 'scheduleExpression',
      // },
      schemaChangePolicy: {
        deleteBehavior: 'LOG',
        updateBehavior: 'UPDATE_IN_DATABASE',
      },
      tablePrefix: 'source_'
    });

    const crawler_lambda = new lambda.Function(this, 'lambda_crawler_sns', {
      runtime: lambda.Runtime.PYTHON_3_7, //execution enviroment
      code: lambda.Code.fromAsset("lambda"),  //directory used from where code is loaded
      handler: 'lambda_crawler_sns.lambda_handler', //name of file.function is lambda_handler in the code for lambda
      timeout: cdk.Duration.minutes(10),
        });
    
  // create a policy
    const permissions_to_glue_crawler_lambda = new iam.PolicyStatement({
      actions: ['glue:*'],
      resources: ['*'],
    });

    // add the policy to the Function's role
   
    crawler_lambda.role?.attachInlinePolicy(
      new iam.Policy(this, 'glue crawler source data cross account', {
        statements: [permissions_to_glue_crawler_lambda],
      }),
    );
    
    const sns_crawler = new tasks.LambdaInvoke(this, 'Crawler Lambda SNS', {
      lambdaFunction: crawler_lambda,
      // Lambda's result is in the attribute `Payload`
      outputPath: '$.Payload',
        });
// Create SNS topic 

    const topic = new sns.Topic(this, 'Topic', {
      displayName: 'testing sns notifications using cdk',
    });

// Create subscription
    topic.addSubscription(new subscriptions.EmailSubscription('himanshu.aggarwal_ext@michelin.com'));
    topic.addSubscription(new subscriptions.EmailSubscription('himanshuagg1991@gmail.com'));

/////
    const definition = sns_crawler
    .next(startQueryExecutionJob_create_table_billing_requirement)

    const state_machine = new sfn.StateMachine(this, 'test_sns', {
      definition
    });

    // set the rule how the notifications are sent 
    // Here in the rule we specify which AWS resource that will be checked for the statuses mentioned in the event pattern
    const rule1 = new events.Rule(this, 'stepfunctions rule', {
      eventPattern: {
       "source": ["aws.states"],
       "detail": {
       "status": ["FAILED", "TIMED_OUT", "ABORTED"], 
       "stateMachineArn": [`${state_machine.stateMachineArn}`]
  }
      },
    });

// Add a target to the rule created 

    rule1.addTarget(new targets.SnsTopic(topic , {
      // check how we can set the prop retryAttempts
    }));


    /////// check SNS with glue crawler -
    // Rule for the crawler
    const rule2 = new events.Rule(this, 'glue crawler rule', {
      eventPattern: {
        "source": ["aws.glue"],
        "account": ["464340339497"],
        "region": ["us-east-1"],
        "detail": {
          "crawlerName": ["crawler_test_cdk_for_sns"],
          "state": ["Failed"],
          "message": ["Crawler Failed"]
        }
      },
    });
    rule2.addTarget(new targets.SnsTopic(topic , {
      // check how we can set the prop retryAttempts
    }));

  }
}

