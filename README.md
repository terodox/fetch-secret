# fetch-secret

[![Build Status](https://cloud.drone.io/api/badges/terodox/fetch-secret/status.svg)](https://cloud.drone.io/terodox/fetch-secret)

A simple utility for fetching a secret from AWS secrets manager into file that can be sourced by bash.

## Usage

```bash
npx fetch-secrets --output ./fileToAppendTo.sh --role arn:aws:iam::${AWS_ACCOUNT_ID}:role/some-role --secret arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:someSecretName
```