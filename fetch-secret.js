#!/usr/bin/env node
// This requires the assumed roles have the following permissions:
// secretsmanager:GetSecretValue

const AWS = require('aws-sdk');
const commandLineArgs = require('command-line-args')
const commandLineUsage = require('command-line-usage')
const fs = require('fs');

const commandLineOptions = [
    {
        name: 'output',
        alias: 'o',
        type: String,
        typeLabel: '{underline file}',
        description: 'File path to output secrets JSON'
    },
    {
        name: 'role',
        alias: 'r',
        type: String,
        typeLabel: '{underline AWS ARN}',
        description: 'Optional role ARN to assume when fetching secret'
    },
    {
        name: 'secret',
        alias: 's',
        type: String,
        typeLabel: '{underline AWS ARN | string}',
        description: 'Secret ARN/name to read'
    },
    {
        name: 'help',
        alias: 'h',
        type: Boolean,
        default: false,
        description: 'Display usage'
    }
];

function displayUsage() {
    const sections = [
        {
            header: 'Fetch Secrets',
            content: 'Fetch secrets from secrets manager and output to a file'
        },
        {
            header: 'Options',
            optionList: commandLineOptions
        }
    ];
    const usage = commandLineUsage(sections);
    console.log(usage);
}

function getOptions() {
    const options = commandLineArgs(commandLineOptions);

    if(options.help) {
        displayUsage();
        process.exit(0);
    }
    if(!options.output || !options.secret) {
        displayUsage();
        process.exit(1);
    }
    return options;
}

async function getCredentialsForRole({ roleArn }) {
    const sts = new AWS.STS();

    console.log('Assuming role:', roleArn);
    const { Credentials } = await sts.assumeRole({
        RoleArn: roleArn,
        RoleSessionName: 'FetchSecretsAssumingRole',
        // 900 seconds is the MINIMUM that can be set
        DurationSeconds: 900
    }).promise();

    return {
        accessKeyId:     Credentials.AccessKeyId,
        secretAccessKey: Credentials.SecretAccessKey,
        sessionToken:    Credentials.SessionToken
    };
}

async function getSecretWithCredentials({ credentials, secretId }) {
    const secretsManager = new AWS.SecretsManager({
        region: 'eu-west-1',
        ...credentials
    });

    console.log('Fetching secret for arn:', secretId);
    const secretResponse = await secretsManager.getSecretValue({
            SecretId: secretId,
            VersionStage: "AWSCURRENT"
    }).promise();

    return JSON.parse(secretResponse.SecretString);
}

(async function() {
    try {
        const {
            output,
            role: roleArn,
            secret: secretId
        } = getOptions();

        const credentials = roleArn ? await getCredentialsForRole({ roleArn }) : undefined;
        const secretJson = await getSecretWithCredentials({
            credentials,
            secretId
        });

        for(const [key, value] of Object.entries(secretJson)) {
            const bashSafeValue = String(value).replace(/'/g, "'\"'\"'");
            const bashExportString = `\nexport ${key}='${bashSafeValue}'`;
            console.log('Appending to:', output);
            fs.appendFileSync(output, bashExportString);
        }
    } catch(error) {
        console.error(error);
        process.exit(1);
    }
})();
