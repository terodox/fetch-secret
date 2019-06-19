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
        description: 'Role ARN to assume for fetching secret'
    },
    {
        name: 'secret',
        alias: 's',
        type: String,
        typeLabel: '{underline AWS ARN}',
        description: 'Seret ARNs to read'
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
            header: 'Fetch Secretes',
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
    if(!options.output || !options.role || !options.secret) {
        displayUsage();
        process.exit(1);
    }
    return options;
}

async function getSecretWithCredentials({ roleArn, secretArn }) {
    const sts = new AWS.STS();

    console.log('Assuming role:', roleArn);
    const assumeRoleResponse = await sts.assumeRole({
        RoleArn: roleArn,
        RoleSessionName: 'FetchSecretsAssumingRole',
        // 900 seconds is the MINIMUM that can be set
        DurationSeconds: 900
    }).promise();
    const credentials = assumeRoleResponse.Credentials;

    const secretsManager = new AWS.SecretsManager({
        region: 'eu-west-1',
        accessKeyId: credentials.AccessKeyId,
        secretAccessKey: credentials.SecretAccessKey,
        sessionToken: credentials.SessionToken,
    });

    console.log('Fetching secret for arn:', secretArn);
    const secretResponse = await secretsManager.getSecretValue({
            SecretId: secretArn,
            VersionStage: "AWSCURRENT"
    }).promise();

    return JSON.parse(secretResponse.SecretString);
}

(async function() {
    try {
        const options = getOptions();

        const secretJson = await getSecretWithCredentials({
            roleArn: options.role,
            secretArn: options.secret
        });

        for(const [key, value] of Object.entries(secretJson)) {
            const bashSafeValue = String(value).replace(/'/g, "'\"'\"'");
            const bashExportString = `\nexport ${key}='${bashSafeValue}'`;
            fs.appendFileSync(options.output, bashExportString);
        }
    } catch(error) {
        console.error(error);
        process.exit(1);
    }
})();