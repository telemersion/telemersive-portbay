public class CmndFromTelematicThread extends Thread {
  boolean isRunning;
  byte[] buf = new byte[packageSize_cmnd];

  public void kill() {
    isRunning = false;
  }

  public void run() {
    System.out.println("CmndFromTelematicThread is running..");
    isRunning = true;
    DatagramPacket NatNetCmndPacket = new DatagramPacket(buf, buf.length);
    while (isRunning) {
      try {
        while (true) {   
          telematicServer_Cmnd.receive(NatNetCmndPacket);

          if (testForHandShake(NatNetCmndPacket.getData())) {
            countHandShakeMsgs++;
          } else {
            if (clientCmndPort != 0) {
              byte[] newArray = trimmByteArray(NatNetCmndPacket);
              
              if(verbose_cmnd){
                println();
                print("cmnd package: Server ("+NatNetCmndPacket.getPort()+") -> NatNetClient (" + clientCmndAddress + ":" + clientCmndPort+ ") sends: ");
                printOutByteArray(newArray);  
              }
                            
              DatagramPacket proxyPacket = new DatagramPacket(newArray, newArray.length, clientCmndAddress, clientCmndPort);
              motiveClient_Cmnd.send(proxyPacket);
              countFromCmndMsgs++;
            } else {
              println("received cmnd package from server  ("+NatNetCmndPacket.getPort()+") to NatNetClient without having a client address. dropping the package");
            }
          }
        }
      } 
      catch(Exception e) {
        println();
        print("cmnd package exception: server -> NatNetClient " + e.toString());
        ;
      }
    }
  }
}
