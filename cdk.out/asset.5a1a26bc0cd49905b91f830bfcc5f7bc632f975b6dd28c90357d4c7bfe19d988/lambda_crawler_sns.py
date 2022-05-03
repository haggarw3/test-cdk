import json
import boto3
import time 
import timeit
import logging
# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


def lambda_handler(event, context):
    client = boto3.client('glue')
    client.start_crawler(Name = 'crawler_test_cdk_for_sns')

    logger.info('#### INITIATED BY EVENT: ')
    
    timeout_seconds = 600
    start_time = timeit.default_timer()
    abort_time = start_time + timeout_seconds
    iteration = 0

    while True:
        response = client.get_crawler(Name = 'crawler_test_cdk_for_sns')
        crawler_run_status = response['Crawler']['State']
        logger.info('#### Logging Crawler Status:'+ str(iteration))
        logger.info(f'#### Logging Crawler Status: {iteration}')
        logger.info(crawler_run_status)
        iteration += 1

        if crawler_run_status == 'SUCCEEDED':
            logger.info('crawler finished')
            return {
                'statusCode': 200,
                'body': json.dumps('crawler finished')
            }
        elif crawler_run_status == 'FAILED':
            logger.info('crawler failed')
            raise Exception('Crawler Errored Out')

        elif timeit.default_timer() > abort_time:
            logger.info('crawler failed -  Timed Out')
            raise TimeoutError("Crawler Failed")
        time.sleep(60)

    # if retry_count >= max_retries:
    #     return {
    #         'statusCode': 200,
    #         'body': json.dumps('crawler failed')
    #     }
    # else:    
    #     raise Exception('Crawler Errored Out')