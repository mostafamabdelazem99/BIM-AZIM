#include "BimAzimMCPBridge.h"
#include "MCPHttpServer.h"
#include "Modules/ModuleManager.h"
#include "Misc/MessageDialog.h"

#define LOCTEXT_NAMESPACE "FBimAzimMCPBridgeModule"

void FBimAzimMCPBridgeModule::StartupModule()
{
    HttpServer = MakeShared<FMCPHttpServer>();
    HttpServer->Start(30012);

    UE_LOG(LogTemp, Log, TEXT("[BimAzimMCPBridge] Started HTTP bridge on port 30012"));
}

void FBimAzimMCPBridgeModule::ShutdownModule()
{
    if (HttpServer.IsValid())
    {
        HttpServer->Stop();
        HttpServer.Reset();
    }

    UE_LOG(LogTemp, Log, TEXT("[BimAzimMCPBridge] Stopped HTTP bridge"));
}

#undef LOCTEXT_NAMESPACE

IMPLEMENT_MODULE(FBimAzimMCPBridgeModule, BimAzimMCPBridge)
