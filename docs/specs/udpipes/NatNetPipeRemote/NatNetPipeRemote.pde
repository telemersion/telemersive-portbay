/**
 * NatNetPipeRemote
 * 
 * This script is one of the two scripts necessary to send Optitrack Motive data to a 
 * machine in a different network somewhere on this planet.
 * All that is needed are two connections to a server with UDP proxy services running.
 * 
 * This process has to run on a machine that is in the same LAN as Unity is running.
 * 
 * It is routing command and data streams between the telematic server and the Motive Client:
 * Motive data -> NatNetPipeLocal -> Server -> NatNetPipeRemote -> Unity (or any other Motive client)
 * Motive cmnd <-> NatNetPipeLocal <-> Server <-> NatNetPipeRemote <-> Unity (or any other Motive client)
 *  
 * (c) zhdk 2022 by Martin Froehlich
 * 
 */


import processing.net.*;
import java.net.*;

// to make this work you need to to start a room on the telemersive-router. 
// If the room number is 11, your ports are 11006 / 11001, if it is 12 -> 12006 / 12001

String telematicIP = "195.176.247.64";        // IP of telemersion.zhdk.ch !!! we are connecting directly to the server!!
int    telematicPort_Data = 11006;            // telemersive server UDP proxy port for the data stream (one2manyMo)
int    telematicPort_Cmnd = 11001;            // telemersive server UDP proxy port for the cmnd stream (one2manyBi)

String MulitCastIP       = "239.255.42.99";   // Multicast IP (default 239.255.42.99)
int    motivePort_Data    = 1511;              // Motives Multicast Data port
int    motivePort_Cmnd    = 1510;              // Motives Command listening port

boolean verbose_cmnd      = false;            // prints out all the receiving and sending command packages
boolean verbose_data      = false;            // prints out all the receiving and sending data packages

int packageSize_cmnd      = 40000;            // lower this number if the receivier crashes
int packageSize_data      = 40000;          // lower this number if the receivier crashes

/*********************************************************/
// No changes needed below this line
/*********************************************************/


// NATNET message ids
/*
#define NAT_CONNECT                 0 
#define NAT_SERVERINFO              1
#define NAT_REQUEST                 2
#define NAT_RESPONSE                3
#define NAT_REQUEST_MODELDEF        4
#define NAT_MODELDEF                5
#define NAT_REQUEST_FRAMEOFDATA     6
#define NAT_FRAMEOFDATA             7
#define NAT_MESSAGESTRING           8
#define NAT_UNRECOGNIZED_REQUEST    100
#define UNDEFINED                   999999.9999
*/

CmndFromTelematicThread cmndFromTeleThread;
CmndToTelematicThread cmndToTeleThread;
DataThread dataThread;
HandShakeThread handShakeThread;

MulticastSocket motiveClient_Data = null;
DatagramSocket motiveClient_Cmnd = null;
InetAddress motiveGroup;

DatagramSocket telematicServer_Data;
DatagramSocket telematicServer_Cmnd;
InetAddress telematicAddress;

int clientCmndPort = 0;
InetAddress clientCmndAddress = null;

int countHandShakeMsgs = 0;
int countDataMsgs = 0;
int countToCmndMsgs = 0;
int countFromCmndMsgs = 0;
int checkIntervall = 500;
int lastCheck = 0;

int sizeDataMsg = 0;

void setup() {
  frameRate(5);
  size(600, 200);
  background(50);
  fill(200);
  lastCheck = millis();
 
  try {
    System.setProperty("java.net.preferIPv4Stack", "true");

    println("create motiveClient_Data on port: " + motivePort_Data);
    motiveClient_Data = new MulticastSocket(motivePort_Data);
    println("create motiveClient_Cmnd on port: " + motivePort_Cmnd);
    motiveClient_Cmnd = new DatagramSocket(motivePort_Cmnd);
    println("create motiveGroup on IP: " + MulitCastIP);
    motiveGroup = InetAddress.getByName(MulitCastIP);
    println("join motiveGroup..");
    motiveClient_Data.joinGroup(motiveGroup);
    println("... motiveGroup joined");

    telematicServer_Data = new DatagramSocket(0);
    telematicServer_Cmnd = new DatagramSocket(0);
    println("create telematicAddress on IP: " + telematicIP);
    telematicAddress = InetAddress.getByName(telematicIP);

    handShakeThread = new HandShakeThread();
    handShakeThread.start();

    dataThread = new DataThread();
    dataThread.start();

    cmndFromTeleThread = new CmndFromTelematicThread();
    cmndFromTeleThread.start();

    cmndToTeleThread = new CmndToTelematicThread();
    cmndToTeleThread.start();
  } 
  catch(Exception e) {
    println("there was a problem: " + e.getMessage());
  }
}

void draw() {
  if((lastCheck + checkIntervall) < millis()){
    background(100,100,255);

    textSize(32);
    fill(0, 0, 0);
    text("Server > NatNetPipeRemote > Client", 10, 30);
    textSize(16);
    text("Data:  " + telematicIP + ":" + telematicPort_Data + " -> " + motivePort_Data, 10, 50);
    textSize(16);
    text("Cmnd: "  + telematicIP + ":" + telematicPort_Cmnd +" <-> " +  motivePort_Cmnd, 10, 70);

    if(countHandShakeMsgs > 0){
      fill(0, 255, 0);
    } else {
      fill(255, 0, 0);
    }
    rect(0, 80, 600, 20);

    if(countFromCmndMsgs > 0){
      fill(0, 255, 0);
    } else {
      fill(255, 0, 0);
    }
    rect(0, 100, 200, 100);
    
    if(countToCmndMsgs > 0){
      fill(0, 255, 0);
    } else {
      fill(255, 0, 0);
    }
    rect(200, 100, 200, 100);

    if(countDataMsgs > 0){
      fill(0, 255, 0);
    } else {
      fill(255, 0, 0);
    }
    rect(400, 100, 200, 100);

    textSize(14);
    fill(0, 0, 0);
    text("NatNetPipeLocal -> Server -> NatNetPipeRemote", 140, 95);
    text("Server -> Cmnd -> Client", 10, 140);
    text("fps: " + countToCmndMsgs * 5, 10, 160);
    text("Server <- Cmnd <- Client", 210, 140);
    text("fps: " + countFromCmndMsgs * 5, 210, 160);
    text("Server -> Data -> Client", 410, 140);
    text("fps: " + countDataMsgs * 5 / 3, 410, 160);
    text("data size: " + sizeDataMsg, 410, 180);

    countHandShakeMsgs = 0;
    countFromCmndMsgs = 0;
    countToCmndMsgs = 0;
    countDataMsgs = 0;
    lastCheck = millis();
  }
}

public byte[] trimmByteArray(DatagramPacket bArray) {
  byte[] getArray = bArray.getData();
  byte[] returnArray = new byte[bArray.getLength()];
  for (int i = 0; i < bArray.getLength(); i++) {
    returnArray[i] = getArray[i];
  }
  return returnArray;
}

public void printOutByteArray(byte[] bArray) {
  for (int i = 0; i < bArray.length; i++) {
    print(bArray[i] + "|");
  }
  println();
  print("size: " + bArray.length);
  println();
}

public boolean testForHandShake(byte[] bArray) {
  if(bArray.length >= 3){
    if(bArray[0] == 8 && bArray[1] == 8 && bArray[2] == 8){
      return true;
    } else if(bArray[0] == 9 && bArray[1] == 9 && bArray[2] == 9){
      println("ATTENTION: There seems to be another NatNetPipeRemote...");
    }
  }
  return false;
}

void stop() {
  try {
    motiveClient_Data.close();
    motiveClient_Cmnd.close();
    telematicServer_Data.close();
    telematicServer_Cmnd.close();
  } 
  catch(Exception e) {
    ;
  }
}
