import json
import boto3
import time 
import logging
# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


def lambda_handler(event, context):
    client = boto3.client('glue')
    client.start_crawler(Name = 'crawler_test_cdk_for_sns')

    iteration = 0

    while True:
        response = client.get_crawler(Name = 'crawler_test_cdk_for_sns')
        crawler_run_state = response['Crawler']['State']
        # Note the state can only be either - 'READY'|'RUNNING'|'STOPPING'
        logger.info(f'#### Logging Crawler State: {iteration}')
        logger.info(crawler_run_state)
        iteration += 1

        crawler_run_status = response['Crawler']['LastCrawl']['Status']
         # Note the status can only be either - 'SUCCEEDED'|'CANCELLED'|'FAILED'
        logger.info(f'#### Logging Crawler Status: {crawler_run_status}')
        
        if crawler_run_status == 'SUCCEEDED':
            logger.info('crawler finished')
            return {
                'statusCode': 200,
                'body': json.dumps('crawler finished')
            }
        elif crawler_run_status == 'FAILED':
            error_message = response['Crawler']['LastCrawl']['ErrorMessage']
            logger.info('crawler failed')
            logger.info(f'{error_message}')
            raise Exception('Crawler Errored Out')
        time.sleep(60)