import com.cloudbees.plugins.credentials.CredentialsProvider
import com.cloudbees.plugins.credentials.CredentialsScope
import com.cloudbees.plugins.credentials.SystemCredentialsProvider
import com.cloudbees.plugins.credentials.common.StandardCredentials
import com.cloudbees.plugins.credentials.domains.Domain
import com.cloudbees.plugins.credentials.impl.UsernamePasswordCredentialsImpl
import hudson.security.FullControlOnceLoggedInAuthorizationStrategy
import hudson.security.HudsonPrivateSecurityRealm
import hudson.model.User
import hudson.model.ParametersDefinitionProperty
import hudson.model.StringParameterDefinition
import hudson.util.Secret
import jenkins.model.Jenkins
import jenkins.security.ApiTokenProperty
import org.jenkinsci.plugins.plaincredentials.impl.StringCredentialsImpl
import org.jenkinsci.plugins.workflow.cps.CpsFlowDefinition
import org.jenkinsci.plugins.workflow.job.WorkflowJob

def jenkins = Jenkins.get()
def adminUser = System.getenv("JENKINS_USER") ?: "admin"
def adminPassword = System.getenv("JENKINS_API_TOKEN") ?: "admin"
def jobName = System.getenv("JENKINS_JOB_NAME") ?: "repo-cicd-engine"
def jenkinsfilePath = new File("/workspace/Jenkinsfile")
def credentialsStore = SystemCredentialsProvider.getInstance().getStore()

def firstNonBlank = { values ->
  values.find { value -> value != null && value.toString().trim() }?.toString()?.trim() ?: ""
}

def findCredentialById = { credentialId ->
  CredentialsProvider.lookupCredentials(
    StandardCredentials.class,
    jenkins,
    null,
    null
  ).find { credential -> credential.id == credentialId }
}

def upsertStringCredential = { credentialId, description, value ->
  if (!value) {
    return
  }

  def credential = new StringCredentialsImpl(
    CredentialsScope.GLOBAL,
    credentialId,
    description,
    Secret.fromString(value)
  )
  def existing = findCredentialById(credentialId)

  if (existing != null) {
    credentialsStore.updateCredentials(Domain.global(), existing, credential)
  } else {
    credentialsStore.addCredentials(Domain.global(), credential)
  }
}

def upsertUsernamePasswordCredential = { credentialId, description, username, password ->
  if (!username || !password) {
    return
  }

  def credential = new UsernamePasswordCredentialsImpl(
    CredentialsScope.GLOBAL,
    credentialId,
    description,
    username,
    password
  )
  def existing = findCredentialById(credentialId)

  if (existing != null) {
    credentialsStore.updateCredentials(Domain.global(), existing, credential)
  } else {
    credentialsStore.addCredentials(Domain.global(), credential)
  }
}

def dockerRegistry = (System.getenv("DOCKER_REGISTRY") ?: "").trim()
def registryPath = dockerRegistry.contains("/") ? dockerRegistry.substring(dockerRegistry.indexOf("/") + 1) : ""
def registryOwnerHint = registryPath && registryPath != "your-org" ? registryPath.split("/")[0] : ""
def githubPat = firstNonBlank([
  System.getenv("JENKINS_GITHUB_PAT"),
  System.getenv("GITHUB_PAT"),
  System.getenv("GITHUB_TOKEN"),
  System.getenv("GHCR_TOKEN")
])
def registryUsername = firstNonBlank([
  System.getenv("JENKINS_REGISTRY_USERNAME"),
  System.getenv("REGISTRY_USERNAME"),
  System.getenv("GHCR_USERNAME"),
  System.getenv("GITHUB_USERNAME"),
  registryOwnerHint
])
def registryPassword = firstNonBlank([
  System.getenv("JENKINS_REGISTRY_PASSWORD"),
  System.getenv("REGISTRY_PASSWORD"),
  System.getenv("REGISTRY_TOKEN"),
  System.getenv("GHCR_TOKEN"),
  githubPat
])

def securityRealm = jenkins.getSecurityRealm()
if (!(securityRealm instanceof HudsonPrivateSecurityRealm)) {
  securityRealm = new HudsonPrivateSecurityRealm(false)
  jenkins.setSecurityRealm(securityRealm)
}

if (securityRealm.getUser(adminUser) == null) {
  securityRealm.createAccount(adminUser, adminPassword)
}

def user = User.getById(adminUser, true)
def tokenProperty = user.getProperty(ApiTokenProperty.class)
if (tokenProperty == null) {
  tokenProperty = new ApiTokenProperty()
  user.addProperty(tokenProperty)
}

def tokenFile = new File("/var/jenkins_home/secrets/forgeops-api-token")
if (!tokenFile.exists() || tokenFile.getText("UTF-8").trim().isEmpty()) {
  tokenFile.getParentFile().mkdirs()
  def generatedToken = tokenProperty.tokenStore.generateNewToken("forgeops-bootstrap")
  tokenFile.setText(generatedToken.plainValue + System.lineSeparator(), "UTF-8")
  user.save()
}

def authorizationStrategy = new FullControlOnceLoggedInAuthorizationStrategy()
authorizationStrategy.setAllowAnonymousRead(false)
jenkins.setAuthorizationStrategy(authorizationStrategy)

if (githubPat) {
  upsertStringCredential("github-pat", "GitHub personal access token for checkout and bot pushes", githubPat)
} else {
  println("ForgeOps bootstrap: skipped github-pat credential seed because no GITHUB_PAT-compatible env var is set.")
}

if (registryUsername && registryPassword) {
  upsertUsernamePasswordCredential(
    "registry-creds",
    "Container registry credentials for Docker push",
    registryUsername,
    registryPassword
  )
} else {
  println("ForgeOps bootstrap: skipped registry-creds credential seed because registry username/password env vars are incomplete.")
}

if (jenkinsfilePath.exists()) {
  WorkflowJob job = jenkins.getItem(jobName)
  if (job == null) {
    job = jenkins.createProject(WorkflowJob, jobName)
  }

  def parameterDefinitions = [
    new StringParameterDefinition("RUN_ID", "", "Platform pipeline run identifier"),
    new StringParameterDefinition("REPOSITORY_URL", "", "Target repository clone URL"),
    new StringParameterDefinition("REPOSITORY_NAME", "", "owner/name of the selected repository"),
    new StringParameterDefinition("DEFAULT_BRANCH", "main", "Branch to build"),
    new StringParameterDefinition("DOCKER_IMAGE", "ghcr.io/example/app", "Target image name"),
    new StringParameterDefinition("K8S_NAMESPACE", "devops-platform", "Target namespace")
  ]

  def existingParameters = job.getProperty(ParametersDefinitionProperty.class)
  if (existingParameters != null) {
    job.removeProperty(existingParameters)
  }
  job.addProperty(new ParametersDefinitionProperty(parameterDefinitions))
  job.setDefinition(new CpsFlowDefinition(jenkinsfilePath.getText("UTF-8"), true))
  job.setDescription("Bootstrap pipeline managed by ForgeOps.")
  job.save()
}

jenkins.save()
