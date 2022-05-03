// // import { APIGatewayProxyResult } from 'aws-lambda';
// const version = require('./version.json');

// // Duplicated from utilities, since it makes little sense to add a dependency only for this.
// const corsHeaders = {
//     'Access-Control-Allow-Origin': '*',
//     'Access-Control-Allow-Headers': '*',
// };

// export const handler = async (): Promise<APIGatewayProxyResult> => {
//     return {
//         statusCode: 200,
//         body: JSON.stringify(version),
//         headers: corsHeaders,
//     };
// };

