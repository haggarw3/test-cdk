import json
import boto3
import time 

def lambda_handler(event, context):
    client = boto3.client('glue')
    response = client.start_crawler(
        Name = 'crawler_test_cdk_for_sns'
        )
    
    retry_count = 1
    max_retries = 20
    while retry_count < max_retries:
        time.sleep(20)
        crawler_status = client.get_crawler(
            Name = 'crawler_test_cdk_for_sns'
        )
        crawler_run_status = crawler_status['Crawler']['State']
        if crawler_run_status == 'READY':
            break
        else:
            retry_count += 1
    if retry_count >= max_retries:
        return {
            'statusCode': 200,
            'body': json.dumps('crawler failed')
        }
    else:    
        return {
                'statusCode': 200,
                'body': json.dumps('crawler finished')
            }