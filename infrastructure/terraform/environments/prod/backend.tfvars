bucket         = "larekmart-terraform-state-prod"
key            = "environments/prod/terraform.tfstate"
region         = "us-east-1"
dynamodb_table = "larekmart-terraform-locks-prod"
encrypt        = true
