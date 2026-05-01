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
          // listening to motive cmmd-data from motive directly
          motiveClient_Cmnd.receive(NatNetCmndPacket);

          byte[] newArray = trimmByteArray(NatNetCmndPacket);

          if(verbose_cmnd){
            println();
            print("cmnd package: Motive ("+NatNetCmndPacket.getPort()+") -> Server (" + telematicPort_Cmnd + ") sends: ");
            printOutByteArray(newArray); 
          }
       
          // passing on motive cmnd-data telematic server cmnd port
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
