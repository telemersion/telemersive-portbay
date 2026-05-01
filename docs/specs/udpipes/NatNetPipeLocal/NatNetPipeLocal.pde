/**
 * NatNetPipeClient
 * 
 * This script is one of the two scripts necessary to send Optitrack Motive data to a 
 * machine in a different network somewhere on this planet.
 * All that is needed are two connections to a telematic server with UDP proxy services running.
 * 
 * This process has to run on a machine that is in the same LAN as Motive is running.
 * 
 * It is routing command and data streams between Motive and the telematic server:
 * Motive data -> NatNetPipeClient -> Telematic Server -> NatNetPipeServer -> Unity (or any other Motive client)
 * Motive cmnd <-> NatNetPipeClient <-> Telematic Server <-> NatNetPipeServer <-> Unity (or any other Motive client)
 *  
 * (c) zhdk 2018 by Martin Froehlich
 * 
 */
 

import processing.net.*;
import java.net.*;
import java.util.*;
import java.util.Arrays;

// to make this work you need to to start a room on the telemersive-router. 
// If the room number is 11, your ports are 11002 / 11000, if it is 12 -> 12002 / 12000

String localNetworkCard = "eth2";            // name of local network interface. The app prints out all available interfaces on startup
String telematicIP = "195.176.247.64";       // IP of telematic.zhdk.ch!!! we are connecting directly to the server!!
int    telematicPort_Data = 11002;           // Telematic server UDP proxy port for the data stream (one2manyMo)
int    telematicPort_Cmnd = 11000;           // Telematic server UDP proxy port for the cmnd stream (one2manyBi)

String mulitCastIP       = "239.255.42.99";  // Motives Multicast IP (default 239.255.42.99)
String motiveIP          = "10.21.136.113";  // IP of machine on which Motive is running
int    motivePort_Data    = 1511;            // Motives Multicast Data port
int    motivePort_Cmnd    = 1510;            // Motives Command listening port

boolean verbose_cmnd      = false;           // prints out all the receiving and sending command packages
boolean verbose_data      = false;           // prints out all the receiving and sending data packages

int packageSize_cmnd      = 65507;
int packageSize_data      = 65507;
/*********************************************************/
// No changes needed below this line
/*********************************************************/

CmndToTelematicThread cmndToTelematicThread;
CmndFromTelematicThread cmndFromTelematicThread;
DataThread dataThread;
HandShakeThread handShakeThread;

MulticastSocket motiveClient_Data = null;
DatagramSocket motiveClient_Cmnd = null;
InetAddress motiveGroup;

InetAddress motiveServer;

DatagramSocket telematicServer_Data;
DatagramSocket telematicServer_Cmnd;
InetAddress telematicAddress;

int countHandShakeMsgs = 0;
int countToCmndMsgs = 0;
int countFromCmndMsgs = 0;
int countDataMsgs = 0;
int checkIntervall = 500;
int lastCheck = 0;

int sizeDataMsg = 0;

void setup() {
  frameRate(5);
  size(600, 200);
  background(50);
  fill(200);
  lastCheck = millis();
  
  try{
    System.setProperty("java.net.preferIPv4Stack", "true");

    System.out.println("available NetworkInterfaces:");
    Enumeration<NetworkInterface> nifs = NetworkInterface.getNetworkInterfaces();
    while (nifs.hasMoreElements()){
      NetworkInterface nif = nifs.nextElement();
      if(nif.isUp()){          
        if(localNetworkCard.equals(nif.getName())){
          System.out.print("-> ");
        }else {
          System.out.print("   ");
        }
        System.out.println(nif.getName() + "\t" + nif.getInetAddresses().nextElement());
      }
    }
    System.out.println("---> copy/paste the one you want to work with into the setting 'networkName'");
    
    
    NetworkInterface myNif = NetworkInterface.getByName(localNetworkCard);
    
    motiveClient_Data = new MulticastSocket(motivePort_Data);
    motiveClient_Data.setNetworkInterface(myNif);
    motiveClient_Cmnd = new DatagramSocket(new InetSocketAddress(myNif.getInetAddresses().nextElement().getHostName(), 0));
    
   // (new InetSocketAddress(nifAddresses.nextElement(), 0)
    
    motiveGroup = InetAddress.getByName(mulitCastIP);
    motiveServer = InetAddress.getByName(motiveIP);
    motiveClient_Data.joinGroup(motiveGroup);
    
    telematicServer_Data = new DatagramSocket();
    telematicServer_Cmnd = new DatagramSocket(0);
    telematicAddress = InetAddress.getByName(telematicIP);

    byte[] hand = new byte[]{8, 8, 8};
    DatagramPacket handShake = new DatagramPacket(hand, hand.length, telematicAddress, telematicPort_Cmnd);
    telematicServer_Cmnd.send(handShake);

    handShakeThread = new HandShakeThread();
    handShakeThread.start();
    
    dataThread = new DataThread();
    dataThread.start();

    cmndToTelematicThread = new CmndToTelematicThread();
    cmndToTelematicThread.start();

    cmndFromTelematicThread = new CmndFromTelematicThread();
    cmndFromTelematicThread.start();

  } catch(Exception e){
    println(e.getMessage());
  }
}

void draw() {
  if((lastCheck + checkIntervall) < millis()){
    background(100,100,255);
    
    textSize(32);
    fill(0, 0, 0);
    text("Motive > NatNetPipeLocal > Server", 10, 30);
    textSize(16);
    text("Data: " + motiveIP + ":"+ motivePort_Data +"  -> " + telematicIP + ":" + telematicPort_Data, 10, 50);
    textSize(16);
    text("Cmnd: " + motiveIP + ":"+ motivePort_Cmnd +" <-> " + telematicIP + ":" + telematicPort_Cmnd, 10, 70);

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
    text("Motive <- Cmnd <- Server", 10, 140);
    text("fps: " + countToCmndMsgs * 5, 10, 160);
    text("Motive -> Cmnd -> Server", 210, 140);
    text("fps: " + countFromCmndMsgs * 5, 210, 160);
    text("Motive -> Data -> Server", 410, 140);
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
  if(bArray.length == 3){
    if(bArray[0] == 9 && bArray[1] == 9 && bArray[2] == 9){
      return true;
    } else if(bArray[0] == 8 && bArray[1] == 8 && bArray[2] == 8){
      println("ATTENTION: There seems to be another NatNetPipeRemote...");
      return true;
    }
  }
  return false;
}

void stop(){
  try{
    motiveClient_Data.leaveGroup(motiveGroup);
    motiveClient_Data.close();
    motiveClient_Cmnd.close();
    telematicServer_Data.close();
    telematicServer_Cmnd.close();
  } catch(Exception e){
    ;
  }

}
