import json
import boto3
import time 
import timeit
import logging
# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


def lambda_handler(event, context):
    logger.info('#### INITIATED BY EVENT: ')
    logger.info(event['detail'])
    client = boto3.client('glue')
    client.start_crawler(Name = 'crawler_test_cdk_for_sns')
    timeout_seconds = 600
    start_time = timeit.default_timer()
    abort_time = start_time + timeout_seconds
    # retry_count = 1
    # max_retries = 20
    # while retry_count < max_retries:
    while True:
        response = client.get_crawler(Name = 'crawler_test_cdk_for_sns')
        crawler_run_status = response['Crawler']['State']
        if crawler_run_status == 'READY':
            return {
                'statusCode': 200,
                'body': json.dumps('crawler finished')
            }
        elif crawler_run_status == 'FAILED':
            raise Exception('Crawler Errored Out')
        elif timeit.default_timer() > abort_time:
            raise TimeoutError("Crawler Failed")
        time.sleep(5)

    # if retry_count >= max_retries:
    #     return {
    #         'statusCode': 200,
    #         'body': json.dumps('crawler failed')
    #     }
    # else:    
    #     raise Exception('Crawler Errored Out')