public class CmndToTelematicThread extends Thread {
  boolean isRunning;
  byte[] buf = new byte[packageSize_cmnd];

  public void kill() {
    isRunning = false;
  }

  public void run() {
    System.out.println("CmndToTelematicThread is running...");
    isRunning = true;
    DatagramPacket NatNetCmndPacket = new DatagramPacket(buf, buf.length);
    while (isRunning) {
      try {
        while (true) {  
          motiveClient_Cmnd.receive(NatNetCmndPacket);
          
          clientCmndPort = NatNetCmndPacket.getPort();
          clientCmndAddress = NatNetCmndPacket.getAddress();

          byte[] newArray = trimmByteArray(NatNetCmndPacket);

          if(verbose_cmnd){  
            println();
            print("cmnd package: Server (" + telematicPort_Cmnd + ") <- NatNetClient ("+clientCmndAddress + ":"+ NatNetCmndPacket.getPort()+") sends: ");
            printOutByteArray(newArray);  
          }
          
          DatagramPacket proxyPacket = new DatagramPacket(newArray, newArray.length, telematicAddress, telematicPort_Cmnd);
          telematicServer_Cmnd.send(proxyPacket);
          
          countToCmndMsgs++;
        }
      } 
      catch(Exception e) {
        ;
      }
    }
  }
}
