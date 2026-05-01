public class CmndFromTelematicThread extends Thread {
  boolean isRunning;
  byte[] buf = new byte[packageSize_cmnd];

  public void kill() {
    isRunning = false;
  }

  public void run() {
    System.out.println("CmndFromTelematicThread is running...");
    isRunning = true;
    DatagramPacket NatNetCmndPacket = new DatagramPacket(buf, buf.length);
    while (isRunning) {
      try {
        while (true) {   
          // listening to motive cmmd-data from telematic
          telematicServer_Cmnd.receive(NatNetCmndPacket);

          byte[] newArray = trimmByteArray(NatNetCmndPacket);
         
          if (testForHandShake(newArray)) {
            countHandShakeMsgs++;
          } else {
 
            if(verbose_cmnd){
              println();
              print("cmnd package: Motive (" + motivePort_Cmnd + ") <- Server ("+NatNetCmndPacket.getPort()+") sends: ");
              printOutByteArray(newArray); 
            }

            // passing on cmnd-data from telematic server to motive
            DatagramPacket proxyPacket = new DatagramPacket(newArray, newArray.length, motiveServer, motivePort_Cmnd);
            motiveClient_Cmnd.send(proxyPacket);

            countFromCmndMsgs++;
          }
        }
      } 
      catch(Exception e) {
        println();
        print("cmnd package exception: Server -> Mmotive: " + e.toString());
        ;
      }
    }
  }
}
